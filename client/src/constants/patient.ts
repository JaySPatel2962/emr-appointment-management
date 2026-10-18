export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export type Gender = (typeof GENDERS)[keyof typeof GENDERS];

export const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  [GENDERS.MALE]: 'Male',
  [GENDERS.FEMALE]: 'Female',
  [GENDERS.OTHER]: 'Other',
};

/** A normalized Indian mobile number: 10 digits starting with 6, 7, 8 or 9. */
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const NAME_MAX_LENGTH = 100;
