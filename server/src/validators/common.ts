import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '#app/utils/pagination.js';
import { isValidDate, TIME_PATTERN } from '#app/utils/time.js';

// bcrypt only uses the first 72 bytes of a password, so longer ones are refused rather than cut.
export const MAX_PASSWORD_LENGTH = 72;
const MIN_PASSWORD_LENGTH = 8;

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const idParamsSchema = z.object({ id: objectIdSchema });

export const nameSchema = z.string().trim().min(1, 'Required').max(100);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address').max(254));

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH, `Must be at most ${MAX_PASSWORD_LENGTH} characters`)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export const timeSchema = z.string().regex(TIME_PATTERN, 'Must be a time in HH:mm format');

export const dateSchema = z.string().refine(isValidDate, 'Must be a date in YYYY-MM-DD format');

export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};
