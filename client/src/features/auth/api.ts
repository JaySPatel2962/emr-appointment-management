import type { LoginCredentials } from '@/features/auth/schemas';
import { postAuth } from '@/services/api';
import type { Session } from '@/types/models';

/** Sets the httpOnly refresh cookie and returns the access token and the user. */
export const login = (credentials: LoginCredentials): Promise<Session> =>
  postAuth<Session>('/auth/login', credentials);

/** Revokes the refresh token and clears its cookie. */
export const logout = (): Promise<null> => postAuth<null>('/auth/logout');
