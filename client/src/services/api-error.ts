import { AxiosError, isAxiosError } from 'axios';

import { HTTP_STATUS } from '@/constants/http';
import type { FieldError } from '@/types/api';

const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";
const TIMEOUT_MESSAGE = 'The server took too long to answer. Try again.';
const SERVER_MESSAGE = 'Something went wrong on the server. Try again in a moment.';
const UNKNOWN_MESSAGE = 'Something went wrong. Try again.';

interface ApiErrorOptions {
  status: number;
  fieldErrors?: readonly FieldError[];
  requestId?: string | null;
  meta?: Readonly<Record<string, unknown>>;
}

/** A failed request as the app sees it: a status, a message to show, and any field problems. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  /** The HTTP status, or 0 when no response arrived (offline, timeout). */
  readonly status: number;
  /** Field problems from a 400, e.g. `{ field: 'body.newPatient.mobile', message }`. */
  readonly fieldErrors: readonly FieldError[];
  /** The server's X-Request-Id, which support can trace in the logs. */
  readonly requestId: string | null;

  /** The response's meta, for structured detail a feature knows how to read. */
  readonly meta: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    { status, fieldErrors = [], requestId = null, meta = {} }: ApiErrorOptions,
  ) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
    this.meta = meta;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readFieldErrors = (value: unknown): FieldError[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(
        (item): item is FieldError =>
          isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string',
      )
    : [];

/** Turns anything a request can throw into an ApiError with a message fit to show a person. */
export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }
  if (!isAxiosError(error)) {
    return new ApiError(UNKNOWN_MESSAGE, { status: 0 });
  }
  const { response } = error;
  if (!response) {
    const timedOut = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT;
    return new ApiError(timedOut ? TIMEOUT_MESSAGE : NETWORK_MESSAGE, { status: 0 });
  }

  const body = isRecord(response.data) ? response.data : {};
  const meta = isRecord(body.meta) ? body.meta : {};
  const requestId = typeof meta.requestId === 'string' ? meta.requestId : null;
  // 5xx details stay on the server; its own 4xx messages are written for people and shown as is.
  const message =
    response.status < HTTP_STATUS.SERVER_ERROR && typeof body.message === 'string'
      ? body.message
      : SERVER_MESSAGE;

  return new ApiError(message, {
    status: response.status,
    fieldErrors: readFieldErrors(meta.errors),
    requestId,
    meta,
  });
};

export const hasStatus = (error: unknown, status: number): boolean =>
  error instanceof ApiError && error.status === status;
