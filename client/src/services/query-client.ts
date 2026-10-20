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

/**
 * networkMode 'always': this app only works online, so a request made without a connection
 * fails and shows its error state. TanStack Query's default would pause it until the browser
 * reports a connection: an endless skeleton, a list showing old rows under a new filter, and a
 * booking that sends itself whenever the connection comes back. refetchOnReconnect is set
 * explicitly, because with 'always' it would default to off: a screen showing "Couldn't load"
 * loads again by itself once the connection returns.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME.default,
        networkMode: 'always',
        refetchOnReconnect: true,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isWorthRetrying(error),
      },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
