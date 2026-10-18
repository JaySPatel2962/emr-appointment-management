import { MAX_PAGE_SIZE } from '@/constants/http';
import { authHttp, http } from '@/services/http';
import type { ApiEnvelope, Page, PageMeta } from '@/types/api';

// Typed helpers over the HTTP client. Each returns the envelope's `data` (and the paging `meta`
// for lists), so features never handle the envelope or import axios themselves.

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Readonly<Record<string, QueryValue>>;

export interface RequestOptions {
  params?: QueryParams;
  /** Lets TanStack Query cancel a request it no longer needs. */
  signal?: AbortSignal;
}

// A safety net for "fetch the whole day" lists: 20 pages of 100 appointments.
const MAX_PAGES = 20;

/** Drops empty filters, so a request never sends `?status=` or `?patientName=`. */
const withoutEmptyValues = (params: QueryParams = {}): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined && entry[1] !== null && entry[1] !== '',
    ),
  );

const toConfig = ({ params, signal }: RequestOptions) => ({
  params: withoutEmptyValues(params),
  ...(signal ? { signal } : {}),
});

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readPageMeta = (meta: Record<string, unknown>, itemCount: number): PageMeta => ({
  page: numberOr(meta.page, 1),
  limit: numberOr(meta.limit, itemCount),
  total: numberOr(meta.total, itemCount),
  totalPages: numberOr(meta.totalPages, 1),
});

export const getData = async <T>(url: string, options: RequestOptions = {}): Promise<T> => {
  const response = await http.get<ApiEnvelope<T>>(url, toConfig(options));
  return response.data.data;
};

export const getPage = async <T>(url: string, options: RequestOptions = {}): Promise<Page<T>> => {
  const response = await http.get<ApiEnvelope<T[]>>(url, toConfig(options));
  const items = response.data.data;
  return { items, meta: readPageMeta(response.data.meta, items.length) };
};

/** Every item of a list, 100 per request, for views that need a whole day at once. */
export const getAllPages = async <T>(url: string, options: RequestOptions = {}): Promise<T[]> => {
  const fetchPage = (page: number) =>
    getPage<T>(url, { ...options, params: { ...options.params, page, limit: MAX_PAGE_SIZE } });

  const first = await fetchPage(1);
  const pageCount = Math.min(first.meta.totalPages, MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => fetchPage(index + 2)),
  );
  return [first, ...rest].flatMap((page) => page.items);
};

export const postData = async <T>(url: string, body?: unknown): Promise<T> => {
  const response = await http.post<ApiEnvelope<T>>(url, body);
  return response.data.data;
};

export const putData = async <T>(url: string, body: unknown): Promise<T> => {
  const response = await http.put<ApiEnvelope<T>>(url, body);
  return response.data.data;
};

export const deleteData = async <T>(url: string): Promise<T> => {
  const response = await http.delete<ApiEnvelope<T>>(url);
  return response.data.data;
};

/** POST to /auth/*, through the client that neither sends nor refreshes an access token. */
export const postAuth = async <T>(url: string, body?: unknown): Promise<T> => {
  const response = await authHttp.post<ApiEnvelope<T>>(url, body);
  return response.data.data;
};
