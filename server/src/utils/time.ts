/** "HH:mm" on a 24-hour clock, from 00:00 to 23:59. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "YYYY-MM-DD". Use isValidDate() to also reject impossible dates such as 2026-02-30. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MINUTES_PER_HOUR = 60;

/** A half-open time range [start, end) in "HH:mm". */
export interface TimeRange {
  start: string;
  end: string;
}

export const isValidTime = (value: string): boolean => TIME_PATTERN.test(value);

export const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/** "09:30" -> 570 */
export const timeToMinutes = (time: string): number =>
  Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));

/** 570 -> "09:30" */
export const minutesToTime = (minutes: number): string => {
  const hours = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0');
  const mins = String(minutes % MINUTES_PER_HOUR).padStart(2, '0');
  return `${hours}:${mins}`;
};

/** True when two ranges share at least one minute. Ranges that only touch (12:00) do not overlap. */
export const rangesOverlap = (a: TimeRange, b: TimeRange): boolean =>
  timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);

/** True when `inner` lies entirely within `outer`. */
export const rangeContains = (outer: TimeRange, inner: TimeRange): boolean =>
  timeToMinutes(outer.start) <= timeToMinutes(inner.start) &&
  timeToMinutes(inner.end) <= timeToMinutes(outer.end);
