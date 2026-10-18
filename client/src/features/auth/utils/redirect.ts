import { ROUTES } from '@/constants/routes';

/** What <ProtectedRoute> puts in the router state when it sends someone to the login page. */
export interface LoginRedirectState {
  from: { pathname: string; search: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Where to go after logging in: back to the page that asked for it, or the dashboard. */
export const redirectTarget = (state: unknown): string => {
  if (!isRecord(state) || !isRecord(state.from)) {
    return ROUTES.dashboard;
  }
  const { pathname, search } = state.from;
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname === ROUTES.login) {
    return ROUTES.dashboard;
  }
  return `${pathname}${typeof search === 'string' ? search : ''}`;
};
