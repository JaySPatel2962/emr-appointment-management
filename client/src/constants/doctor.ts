/** Allowed appointment slot lengths, in minutes. */
export const SLOT_DURATION_MINUTES = { MIN: 5, MAX: 240 } as const;

/** Lengths offered in forms; the API accepts any whole number from 5 to 240. */
export const SLOT_DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const;

/** Day numbers as the API (and Date#getUTCDay) uses them: 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Clinics plan the week from Monday, so forms list the days in this order. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Upper bounds the API enforces per working day. */
export const MAX_RANGES_PER_DAY = 8;

export const SPECIALIZATION_MAX_LENGTH = 100;
