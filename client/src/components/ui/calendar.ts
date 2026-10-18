import { addDays, addMonths, dayOfWeek, daysInMonth, startOfMonth } from '@/utils/date';

// Pure date maths for the DatePicker's month grid and its keyboard navigation.

/** Weeks start on Monday, as clinics plan theirs. */
export const WEEK_STARTS_ON = 1;

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

/** Days from the start of the week to `date`: 0 for a Monday. */
const offsetInWeek = (date: string): number =>
  (dayOfWeek(date) - WEEK_STARTS_ON + DAYS_PER_WEEK) % DAYS_PER_WEEK;

export const startOfWeek = (date: string): string => addDays(date, -offsetInWeek(date));

export const endOfWeek = (date: string): string => addDays(startOfWeek(date), DAYS_PER_WEEK - 1);

/** The same day of the month `months` away, or that month's last day if it is shorter. */
export const shiftMonths = (date: string, months: number): string => {
  const firstOfTarget = addMonths(date, months);
  const day = Math.min(Number(date.slice(8, 10)), daysInMonth(firstOfTarget));
  return `${firstOfTarget.slice(0, 8)}${String(day).padStart(2, '0')}`;
};

export const clampDate = (date: string, min?: string, max?: string): string => {
  if (min !== undefined && date < min) {
    return min;
  }
  if (max !== undefined && date > max) {
    return max;
  }
  return date;
};

/** The month of `date` as weeks of seven cells: a date of that month, or null as padding. */
export const monthGrid = (date: string): (string | null)[][] => {
  const first = startOfMonth(date);
  const cells: (string | null)[] = [
    ...new Array<null>(offsetInWeek(first)).fill(null),
    ...Array.from({ length: daysInMonth(first) }, (_, index) => addDays(first, index)),
  ];
  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push(null);
  }
  return Array.from({ length: cells.length / DAYS_PER_WEEK }, (_, week) =>
    cells.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK),
  );
};

/**
 * Where a key press in the grid moves focus, following the WAI-ARIA date picker pattern: arrows
 * by day and week, Home and End to the ends of the week, Page Up and Page Down by month (by year
 * with Shift). Null for keys the grid doesn't handle.
 */
export const dateForKey = (key: string, date: string, shiftKey: boolean): string | null => {
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -DAYS_PER_WEEK);
    case 'ArrowDown':
      return addDays(date, DAYS_PER_WEEK);
    case 'Home':
      return startOfWeek(date);
    case 'End':
      return endOfWeek(date);
    case 'PageUp':
      return shiftMonths(date, shiftKey ? -MONTHS_PER_YEAR : -1);
    case 'PageDown':
      return shiftMonths(date, shiftKey ? MONTHS_PER_YEAR : 1);
    default:
      return null;
  }
};
