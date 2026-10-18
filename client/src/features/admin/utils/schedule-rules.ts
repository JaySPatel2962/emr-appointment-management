import type { DaySchedule, TimeRange } from '@/types/models';
import {
  isValidTime,
  minutesToTime,
  rangeContains,
  rangesOverlap,
  timeToMinutes,
} from '@/utils/time';

// The API's schedule rules (server/src/utils/schedule.ts, findScheduleProblems), so the editor
// can point at a problem before saving; the server checks again. The messages are the server's,
// except for a half-filled range, which reads "Enter both times" rather than a format error.

export type SchedulePath = (string | number)[];

export interface ScheduleProblem {
  /** Into the schedule array: [dayIndex, 'sessions' | 'breaks' | 'dayOfWeek', rangeIndex?]. */
  path: SchedulePath;
  message: string;
}

const checkRange = (range: TimeRange, path: SchedulePath): ScheduleProblem[] => {
  if (!isValidTime(range.start) || !isValidTime(range.end)) {
    return [{ path, message: 'Enter both times' }];
  }
  if (timeToMinutes(range.start) >= timeToMinutes(range.end)) {
    return [{ path, message: `Start ${range.start} must be before end ${range.end}` }];
  }
  return [];
};

const findOverlaps = (
  ranges: readonly TimeRange[],
  path: SchedulePath,
  label: string,
): ScheduleProblem[] =>
  ranges.flatMap((range, index) =>
    ranges.slice(index + 1).flatMap((other, offset) =>
      rangesOverlap(range, other)
        ? [
            {
              path: [...path, index + 1 + offset],
              message: `${label} ${range.start}-${range.end} and ${other.start}-${other.end} overlap`,
            },
          ]
        : [],
    ),
  );

const workingHours = (sessions: readonly TimeRange[]): TimeRange => ({
  start: minutesToTime(Math.min(...sessions.map((session) => timeToMinutes(session.start)))),
  end: minutesToTime(Math.max(...sessions.map((session) => timeToMinutes(session.end)))),
});

/**
 * Every problem in a weekly schedule; none means it is valid. Each working day needs a session;
 * every range must start before it ends; sessions may not overlap, nor may breaks; a break must
 * fall within the day's working hours, inside a session or between two. Ranges are half-open,
 * so 09:00-12:00 and 12:00-13:00 touch without overlapping.
 */
export const findScheduleProblems = (schedule: readonly DaySchedule[]): ScheduleProblem[] =>
  schedule.flatMap((day, dayIndex) => {
    if (day.sessions.length === 0) {
      return [
        { path: [dayIndex, 'sessions'], message: 'A working day needs at least one session' },
      ];
    }
    const malformed = [
      ...day.sessions.flatMap((range, index) => checkRange(range, [dayIndex, 'sessions', index])),
      ...day.breaks.flatMap((range, index) => checkRange(range, [dayIndex, 'breaks', index])),
    ];
    if (malformed.length > 0) {
      return malformed;
    }
    const hours = workingHours(day.sessions);
    return [
      ...findOverlaps(day.sessions, [dayIndex, 'sessions'], 'Sessions'),
      ...findOverlaps(day.breaks, [dayIndex, 'breaks'], 'Breaks'),
      ...day.breaks.flatMap((dayBreak, index) =>
        rangeContains(hours, dayBreak)
          ? []
          : [
              {
                path: [dayIndex, 'breaks', index],
                message: `Break ${dayBreak.start}-${dayBreak.end} must fall within working hours ${hours.start}-${hours.end}`,
              },
            ],
      ),
    ];
  });
