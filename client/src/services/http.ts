import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { HTTP_STATUS, REQUEST_TIMEOUT_MS } from '@/constants/http';
import { ApiError, toApiError } from '@/services/api-error';
import { authSession } from '@/services/auth-session';
import type { ApiEnvelope } from '@/types/api';
import type { Session } from '@/types/models';

type RetriableRequest = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean };

const REFRESH_LOCK = 'emr-auth-refresh';

const createClient = (): AxiosInstance =>
  axios.create({
    baseURL: env.apiUrl,
    // Sends the httpOnly refresh cookie, which the browser keeps for /api/v1/auth only.
    withCredentials: true,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: 'application/json' },
  });

/** For /auth/*: never sends an access token, and never refreshes on a 401. */
export const authHttp = createClient();

/** For everything else: sends the access token, and after a 401 refreshes it once and retries. */
export const http = createClient();

// Cancelled requests pass through untouched, so TanStack Query can tell them from failures.
const rethrow = (error: unknown): never => {
  throw axios.isCancel(error) ? error : toApiError(error);
};

authHttp.interceptors.response.use(undefined, rethrow);

// Two tabs must never present the same refresh cookie at once: the server would treat the second
// as a stolen token and end every session. The Web Locks API runs one refresh at a time across
// this browser's tabs, and each one sends the cookie the previous refresh rotated.
const exclusively = <T>(task: () => Promise<T>): Promise<T> =>
  'locks' in navigator ? navigator.locks.request(REFRESH_LOCK, task) : task();

let refreshInFlight: Promise<string> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Callers share one request: every 401
 * that arrives while it runs waits for the same answer, then retries with the new token.
 */
export const refreshAccessToken = (): Promise<string> => {
  refreshInFlight ??= exclusively(async () => {
    const response = await authHttp.post<ApiEnvelope<Session>>('/auth/refresh');
    authSession.start(response.data.data);
    return response.data.data.accessToken;
  })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED) {
        authSession.expire();
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

const tokenSentWith = (request: InternalAxiosRequestConfig): string | null => {
  const header = request.headers.get('Authorization');
  return typeof header === 'string' ? header.replace(/^Bearer /, '') : null;
};

http.interceptors.request.use(async (request) => {
  // A request that starts during a refresh waits for it instead of failing with the old token.
  if (refreshInFlight) {
    await refreshInFlight.catch(() => undefined);
  }
  const token = authSession.getAccessToken();
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

http.interceptors.response.use(undefined, async (error: unknown) => {
  if (
    !axios.isAxiosError(error) ||
    error.response?.status !== HTTP_STATUS.UNAUTHORIZED ||
    !error.config
  ) {
    return rethrow(error);
  }
  const request: RetriableRequest = error.config;
  if (request.retriedAfterRefresh) {
    return rethrow(error);
  }
  request.retriedAfterRefresh = true;

  // Skip the refresh when another request already replaced the token this one carried.
  if (authSession.getAccessToken() === tokenSentWith(request)) {
    try {
      await refreshAccessToken();
    } catch {
      return rethrow(error);
    }
  }
  return http.request(request);
});
