export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;

export type Gender = (typeof GENDERS)[keyof typeof GENDERS];

/** Patient codes look like PAT-000001: a prefix and a zero-padded number from an atomic counter. */
export const PATIENT_CODE_PREFIX = 'PAT';
export const PATIENT_CODE_DIGITS = 6;
export const PATIENT_CODE_COUNTER = 'patientCode';

/** A normalized Indian mobile number: 10 digits starting with 6, 7, 8 or 9. */
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
