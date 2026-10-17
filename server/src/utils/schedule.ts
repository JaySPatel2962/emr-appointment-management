import { DAY_OF_WEEK } from '#app/constants/doctor.js';
import {
  isValidTime,
  minutesToTime,
  rangeContains,
  rangesOverlap,
  timeToMinutes,
} from '#app/utils/time.js';
import type { TimeRange } from '#app/utils/time.js';

/** One working day of a doctor's weekly schedule. Days that are not listed are days off. */
export interface DaySchedule {
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number;
  sessions: readonly TimeRange[];
  breaks: readonly TimeRange[];
}

type SchedulePath = (string | number)[];

export interface ScheduleProblem {
  path: SchedulePath;
  message: string;
}

const checkRange = (range: TimeRange, path: SchedulePath): ScheduleProblem[] => {
  if (!isValidTime(range.start) || !isValidTime(range.end)) {
    return [{ path, message: 'Times must use the HH:mm format' }];
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

/** From the first session's start to the last session's end. */
const workingHours = (sessions: readonly TimeRange[]): TimeRange => ({
  start: minutesToTime(Math.min(...sessions.map((session) => timeToMinutes(session.start)))),
  end: minutesToTime(Math.max(...sessions.map((session) => timeToMinutes(session.end)))),
});

/**
 * Checks a doctor's weekly schedule and returns every problem found (an empty array means it
 * is valid). Each day may appear once and needs at least one session; every range must run
 * from an earlier to a later time; sessions may not overlap each other, nor may breaks. A
 * break must fall within the day's working hours: it can cut time out of a session or sit in
 * the gap between two sessions, like a 12:00-13:00 lunch between 09:00-12:00 and 13:00-17:00.
 * Ranges are half-open, so 09:00-12:00 and 12:00-13:00 touch without overlapping.
 *
 * Used both by the request validators and by the Doctor model, so the rules live in one place.
 */
export const findScheduleProblems = (schedule: readonly DaySchedule[]): ScheduleProblem[] => {
  const problems: ScheduleProblem[] = [];
  const seenDays = new Set<number>();

  schedule.forEach((day, dayIndex) => {
    const validDay =
      Number.isInteger(day.dayOfWeek) &&
      day.dayOfWeek >= DAY_OF_WEEK.SUNDAY &&
      day.dayOfWeek <= DAY_OF_WEEK.SATURDAY;
    if (!validDay) {
      problems.push({
        path: [dayIndex, 'dayOfWeek'],
        message: 'dayOfWeek must be 0 (Sunday) to 6 (Saturday)',
      });
    } else if (seenDays.has(day.dayOfWeek)) {
      problems.push({
        path: [dayIndex, 'dayOfWeek'],
        message: `Day ${day.dayOfWeek} is listed more than once`,
      });
    }
    seenDays.add(day.dayOfWeek);

    if (day.sessions.length === 0) {
      problems.push({
        path: [dayIndex, 'sessions'],
        message: 'A working day needs at least one session',
      });
      return;
    }

    const malformed = [
      ...day.sessions.flatMap((range, index) => checkRange(range, [dayIndex, 'sessions', index])),
      ...day.breaks.flatMap((range, index) => checkRange(range, [dayIndex, 'breaks', index])),
    ];
    if (malformed.length > 0) {
      // Overlap and placement checks only make sense once every range is well-formed.
      problems.push(...malformed);
      return;
    }

    problems.push(
      ...findOverlaps(day.sessions, [dayIndex, 'sessions'], 'Sessions'),
      ...findOverlaps(day.breaks, [dayIndex, 'breaks'], 'Breaks'),
    );

    const hours = workingHours(day.sessions);
    day.breaks.forEach((dayBreak, index) => {
      if (!rangeContains(hours, dayBreak)) {
        problems.push({
          path: [dayIndex, 'breaks', index],
          message: `Break ${dayBreak.start}-${dayBreak.end} must fall within working hours ${hours.start}-${hours.end}`,
        });
      }
    });
  });

  return problems;
};
