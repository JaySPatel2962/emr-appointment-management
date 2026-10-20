import { z } from 'zod';

import { GENDERS } from '#app/constants/patient.js';
import { clinicNow } from '#app/utils/clinic-time.js';
import { isValidMobile, normalizeMobile } from '#app/utils/mobile.js';
import { dateSchema, nameSchema, paginationQuery } from '#app/validators/common.js';

/** Accepts "+91 98765-43210", "09876543210" and the like; outputs the normalized 10 digits. */
export const mobileSchema = z
  .string()
  .trim()
  .transform(normalizeMobile)
  .refine(isValidMobile, 'Must be a 10-digit Indian mobile number');

/**
 * Digits as typed into a search box: a whole mobile number or the start of one. At least one
 * digit, because separators alone would leave an empty prefix that matches every number.
 */
export const mobileSearchSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{1,20}$/, 'Must contain only digits')
  .regex(/\d/, 'Must contain a digit');

export const newPatientSchema = z.object({
  name: nameSchema,
  mobile: mobileSchema,
  gender: z.enum(GENDERS),
  dateOfBirth: dateSchema
    .refine((date) => date <= clinicNow().date, 'Cannot be in the future')
    .optional(),
});

const searchPatientsQuery = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  ...paginationQuery,
});

export const searchPatientsSchema = z.object({ query: searchPatientsQuery });

export type NewPatientInput = z.output<typeof newPatientSchema>;
export type SearchPatientsQuery = z.output<typeof searchPatientsQuery>;
