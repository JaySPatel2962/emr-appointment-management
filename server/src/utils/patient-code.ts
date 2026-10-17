import { PATIENT_CODE_DIGITS, PATIENT_CODE_PREFIX } from '#app/constants/patient.js';

/** 1 -> "PAT-000001". Past the padding width the number keeps growing: "PAT-1234567". */
export const formatPatientCode = (sequence: number): string =>
  `${PATIENT_CODE_PREFIX}-${String(sequence).padStart(PATIENT_CODE_DIGITS, '0')}`;
