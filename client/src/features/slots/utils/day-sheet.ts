import type { DaySchedule, Slot, TimeRange } from '@/types/models';
import { timeToMinutes } from '@/utils/time';

// Lays a day's slots out the way the clinic thinks about the day: sessions, each with its slots,
// and breaks drawn where they fall. A break inside a session sits between that session's slots;
// a break between two sessions (lunch between morning and afternoon) sits between the sessions.

export type SessionEntry = { kind: 'slot'; slot: Slot } | { kind: 'break'; range: TimeRange };

export interface SessionBlock {
  kind: 'session';
  range: TimeRange;
  /** "Morning", "Afternoon" or "Evening", from the session's start. */
  label: string;
  entries: SessionEntry[];
}

export interface BreakBlock {
  kind: 'break';
  range: TimeRange;
}

export type DaySheetBlock = SessionBlock | BreakBlock;

const NOON = 12 * 60;
const FIVE_PM = 17 * 60;

export const sessionLabel = (start: string): string => {
  const minutes = timeToMinutes(start);
  if (minutes < NOON) {
    return 'Morning';
  }
  return minutes < FIVE_PM ? 'Afternoon' : 'Evening';
};

const startsWithin = (time: string, range: TimeRange): boolean => {
  const minutes = timeToMinutes(time);
  return minutes >= timeToMinutes(range.start) && minutes < timeToMinutes(range.end);
};

const byStart = (a: { start: string }, b: { start: string }): number =>
  timeToMinutes(a.start) - timeToMinutes(b.start);

const entryStart = (entry: SessionEntry): string =>
  entry.kind === 'slot' ? entry.slot.start : entry.range.start;

/**
 * The day's sessions and breaks in time order. Without the doctor's schedule (still loading,
 * say) every slot goes into one block, so the grid still shows.
 */
export const buildDaySheet = (
  slots: readonly Slot[],
  day: DaySchedule | undefined,
): DaySheetBlock[] => {
  const firstSlot = slots[0];
  const lastSlot = slots.at(-1);
  if (!day || day.sessions.length === 0) {
    return firstSlot && lastSlot
      ? [
          {
            kind: 'session',
            range: { start: firstSlot.start, end: lastSlot.end },
            label: sessionLabel(firstSlot.start),
            entries: slots.map((slot) => ({ kind: 'slot', slot })),
          },
        ]
      : [];
  }

  const sessions = [...day.sessions].sort(byStart);
  const insideSession = (range: TimeRange) =>
    sessions.some((session) => startsWithin(range.start, session));

  const sessionBlocks = sessions.map((session): SessionBlock => {
    const entries: SessionEntry[] = [
      ...slots
        .filter((slot) => startsWithin(slot.start, session))
        .map((slot): SessionEntry => ({ kind: 'slot', slot })),
      ...day.breaks
        .filter((range) => startsWithin(range.start, session))
        .map((range): SessionEntry => ({ kind: 'break', range })),
    ];
    entries.sort((a, b) => timeToMinutes(entryStart(a)) - timeToMinutes(entryStart(b)));
    return { kind: 'session', range: session, label: sessionLabel(session.start), entries };
  });

  const gapBreaks = day.breaks
    .filter((range) => !insideSession(range))
    .map((range): BreakBlock => ({ kind: 'break', range }));

  return [...sessionBlocks, ...gapBreaks].sort((a, b) => byStart(a.range, b.range));
};
