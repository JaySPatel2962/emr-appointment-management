/** Allowed appointment slot lengths, in minutes. */
export const SLOT_DURATION_MINUTES = { MIN: 5, MAX: 240 } as const;

/** Days as JavaScript's Date#getDay() numbers them: 0 = Sunday ... 6 = Saturday. */
export const DAY_OF_WEEK = { SUNDAY: 0, SATURDAY: 6 } as const;
