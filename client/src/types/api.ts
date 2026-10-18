/** The envelope every API response uses: `{ success, message, data, meta }`. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: Record<string, unknown>;
}

/** One problem with one input, from a 400's `meta.errors`, e.g. `body.newPatient.mobile`. */
export interface FieldError {
  field: string;
  message: string;
}

/** Paging numbers of a list response: `limit` is at most 100; `totalPages` is 0 when empty. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export type SortOrder = 'asc' | 'desc';
