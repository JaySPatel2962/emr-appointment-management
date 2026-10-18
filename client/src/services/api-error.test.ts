import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { ApiError, toApiError } from '@/services/api-error';

const config = { headers: {} } as InternalAxiosRequestConfig;

const failedWith = (status: number, data: unknown): AxiosError => {
  const response: AxiosResponse = { data, status, statusText: '', headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
};

describe('toApiError', () => {
  it("keeps the server's message, field errors and request id for a 4xx", () => {
    const error = toApiError(
      failedWith(400, {
        success: false,
        message: 'Validation failed',
        data: null,
        meta: {
          requestId: 'abc-123',
          errors: [
            { field: 'body.newPatient.mobile', message: 'Must be a 10-digit Indian mobile' },
          ],
        },
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: 'Validation failed',
      requestId: 'abc-123',
    });
    expect(error.fieldErrors).toEqual([
      { field: 'body.newPatient.mobile', message: 'Must be a 10-digit Indian mobile' },
    ]);
  });

  it("never shows a 5xx's details", () => {
    const error = toApiError(failedWith(500, { message: 'Internal server error' }));

    expect(error.status).toBe(500);
    expect(error.message).toBe('Something went wrong on the server. Try again in a moment.');
  });

  it('reports a request that got no response as a network error', () => {
    const error = toApiError(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config));

    expect(error.isNetworkError).toBe(true);
    expect(error.message).toMatch(/can't reach the server/i);
  });

  it('reports a timeout as one', () => {
    const error = toApiError(new AxiosError('timeout', AxiosError.ECONNABORTED, config));

    expect(error.message).toMatch(/took too long/i);
  });

  it('ignores malformed field errors', () => {
    const error = toApiError(
      failedWith(400, { message: 'Validation failed', meta: { errors: [{ field: 1 }, 'x'] } }),
    );

    expect(error.fieldErrors).toEqual([]);
  });

  it('passes an ApiError through unchanged', () => {
    const original = new ApiError('Slot already booked', { status: 409 });

    expect(toApiError(original)).toBe(original);
  });
});
