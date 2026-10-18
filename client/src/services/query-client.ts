import { QueryClient } from '@tanstack/react-query';

import { HTTP_STATUS } from '@/constants/http';
import { ApiError } from '@/services/api-error';

/** How long fetched data counts as fresh, by how often it changes. */
export const STALE_TIME = {
  /** Slot grids and appointment lists: socket events and mutations keep them current. */
  live: 15_000,
  default: 30_000,
  /** Doctors and their schedules change rarely. */
  slow: 5 * 60_000,
  /** Departments only change through the seed script. */
  static: 30 * 60_000,
} as const;

const MAX_RETRIES = 2;

/** Retry only what a retry can fix: no response at all, or a server error. Never a 4xx. */
const isWorthRetrying = (error: unknown): boolean =>
  error instanceof ApiError && (error.isNetworkError || error.status >= HTTP_STATUS.SERVER_ERROR);

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME.default,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isWorthRetrying(error),
      },
      mutations: { retry: false },
    },
  });
