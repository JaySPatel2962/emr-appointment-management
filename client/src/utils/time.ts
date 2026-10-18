/** "HH:mm" on a 24-hour clock, from 00:00 to 23:59. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const MINUTES_PER_HOUR = 60;

export const isValidTime = (value: string): boolean => TIME_PATTERN.test(value);

/** "09:30" -> 570 */
export const timeToMinutes = (time: string): number =>
  Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));

/** 570 -> "09:30" */
export const minutesToTime = (minutes: number): string => {
  const hours = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0');
  const mins = String(minutes % MINUTES_PER_HOUR).padStart(2, '0');
  return `${hours}:${mins}`;
};

/** "09:00" and "09:15" -> "09:00–09:15" (an en dash, as a range). */
export const formatTimeRange = (start: string, end: string): string => `${start}–${end}`;
