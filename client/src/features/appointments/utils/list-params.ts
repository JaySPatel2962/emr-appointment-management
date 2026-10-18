import { z } from 'zod';

import { APPOINTMENT_SORT_FIELDS, APPOINTMENT_STATUSES } from '@/constants/appointment';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/constants/http';
import type { AppointmentListParams } from '@/features/appointments/api';
import { isValidDate } from '@/utils/date';

// The appointment list keeps its page, sort and filters in the URL, so a reload, a bookmark or
// a shared link shows the same list. Anything invalid in the URL falls back to its default
// instead of breaking the page.

export const DEFAULT_LIST_PARAMS: AppointmentListParams = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  sortBy: 'date',
  sortOrder: 'asc',
};

const text = z.string().trim().min(1).max(100).optional().catch(undefined);
const id = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .optional()
  .catch(undefined);
const date = z.string().refine(isValidDate).optional().catch(undefined);

const paramsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_LIST_PARAMS.page),
  limit: z.coerce
    .number()
    .refine((value) => PAGE_SIZE_OPTIONS.some((option) => option === value))
    .catch(DEFAULT_LIST_PARAMS.limit),
  sortBy: z.enum(APPOINTMENT_SORT_FIELDS).catch(DEFAULT_LIST_PARAMS.sortBy),
  sortOrder: z.enum(['asc', 'desc']).catch(DEFAULT_LIST_PARAMS.sortOrder),
  status: z.enum(APPOINTMENT_STATUSES).optional().catch(undefined),
  patientName: text,
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{1,20}$/)
    .optional()
    .catch(undefined),
  doctorName: text,
  departmentId: id,
  dateFrom: date,
  dateTo: date,
});

const KEYS = Object.keys(paramsSchema.shape) as (keyof AppointmentListParams)[];

export const parseListParams = (search: URLSearchParams): AppointmentListParams => {
  const raw = Object.fromEntries(KEYS.map((key) => [key, search.get(key) ?? undefined]));
  const params = paramsSchema.parse(raw);
  // A range that ends before it starts is dropped, as the API would refuse it.
  return params.dateFrom && params.dateTo && params.dateTo < params.dateFrom
    ? { ...params, dateTo: undefined }
    : params;
};

/** The URL query for `params`, leaving out defaults and empty filters to keep links short. */
export const serializeListParams = (params: AppointmentListParams): URLSearchParams => {
  const search = new URLSearchParams();
  for (const key of KEYS) {
    const value = params[key];
    if (value !== undefined && value !== '' && value !== DEFAULT_LIST_PARAMS[key]) {
      search.set(key, String(value));
    }
  }
  return search;
};

const FILTER_KEYS = [
  'status',
  'patientName',
  'mobile',
  'doctorName',
  'departmentId',
  'dateFrom',
  'dateTo',
] as const satisfies readonly (keyof AppointmentListParams)[];

export const hasActiveFilters = (params: AppointmentListParams): boolean =>
  FILTER_KEYS.some((key) => params[key] !== undefined);

/** The same page, sort and size with every filter removed. */
export const withoutFilters = (params: AppointmentListParams): AppointmentListParams => ({
  page: 1,
  limit: params.limit,
  sortBy: params.sortBy,
  sortOrder: params.sortOrder,
});
