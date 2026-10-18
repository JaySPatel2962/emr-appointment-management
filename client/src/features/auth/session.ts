import { login, logout } from '@/features/auth/api';
import type { LoginCredentials } from '@/features/auth/schemas';
import { authSession } from '@/services/auth-session';
import { refreshAccessToken } from '@/services/http';
import type { User } from '@/types/models';

/**
 * At startup: a refresh cookie that is still good gives this tab a new access token, so a page
 * reload keeps the user signed in. No cookie, an expired one or no server means signed out.
 */
export const restoreSession = async (): Promise<void> => {
  try {
    await refreshAccessToken();
  } catch {
    authSession.expire();
  }
};

export const signIn = async (credentials: LoginCredentials): Promise<User> => {
  const session = await login(credentials);
  authSession.start(session);
  return session.user;
};

export const signOut = async (): Promise<void> => {
  try {
    await logout();
  } catch {
    // Even if the server can't be reached, this tab forgets its token and stops being signed in.
  } finally {
    authSession.signOut();
  }
};
