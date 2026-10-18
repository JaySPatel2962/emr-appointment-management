import { WEEK_ORDER } from '@/constants/doctor';
import type { DaySchedule, TimeRange } from '@/types/models';

// The schedule editor works on all seven days, in the clinic's week order, each switched on or
// off. The API wants only the working days. These convert between the two, and map the API's
// error paths (body.schedule.0.sessions.1) back to the editor's rows.

export interface ScheduleDayValues {
  dayOfWeek: number;
  works: boolean;
  sessions: TimeRange[];
  breaks: TimeRange[];
}

export const EMPTY_RANGE: TimeRange = { start: '', end: '' };

/** The assessment's example day: 09:00-12:00 and 13:00-17:00, with lunch in between. */
export const STANDARD_DAY = {
  sessions: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  breaks: [{ start: '12:00', end: '13:00' }],
} as const;

const MONDAY_TO_FRIDAY: readonly number[] = [1, 2, 3, 4, 5];

/** The editor's seven days from a saved schedule: days not in it are days off. */
export const toEditorDays = (schedule: readonly DaySchedule[]): ScheduleDayValues[] =>
  WEEK_ORDER.map((dayOfWeek) => {
    const saved = schedule.find((day) => day.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      works: saved !== undefined,
      sessions: saved ? saved.sessions.map((range) => ({ ...range })) : [{ ...EMPTY_RANGE }],
      breaks: saved ? saved.breaks.map((range) => ({ ...range })) : [],
    };
  });

/** Monday to Friday on the standard day, the weekend off. */
export const standardWeek = (): ScheduleDayValues[] =>
  WEEK_ORDER.map((dayOfWeek) => {
    const works = MONDAY_TO_FRIDAY.includes(dayOfWeek);
    return {
      dayOfWeek,
      works,
      sessions: works ? STANDARD_DAY.sessions.map((range) => ({ ...range })) : [{ ...EMPTY_RANGE }],
      breaks: works ? STANDARD_DAY.breaks.map((range) => ({ ...range })) : [],
    };
  });

/** What the API stores: only the working days, with their sessions and breaks. */
export const toSchedule = (days: readonly ScheduleDayValues[]): DaySchedule[] =>
  days
    .filter((day) => day.works)
    .map(({ dayOfWeek, sessions, breaks }) => ({ dayOfWeek, sessions, breaks }));

/** The editor row of the n-th working day in the saved schedule. */
export const editorIndexOf = (
  days: readonly ScheduleDayValues[],
  scheduleIndex: number,
): number => {
  const working = days.flatMap((day, index) => (day.works ? [index] : []));
  return working[scheduleIndex] ?? -1;
};

/**
 * The editor's path for an API error on the schedule: `body.schedule.1.breaks.0` is the second
 * working day's first break, which may be the editor's row 3. Null for any other field.
 */
export const scheduleFieldPath =
  (days: readonly ScheduleDayValues[]) =>
  (field: string): string | null => {
    const path = field.startsWith('body.') ? field.slice('body.'.length) : field;
    if (path === 'slotDurationMinutes') {
      return path;
    }
    const match = /^schedule\.(\d+)(\..*)?$/.exec(path);
    if (!match) {
      return null;
    }
    const index = editorIndexOf(days, Number(match[1]));
    return index === -1 ? null : `days.${String(index)}${match[2] ?? ''}`;
  };
