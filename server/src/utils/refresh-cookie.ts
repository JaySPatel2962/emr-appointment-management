import type { CookieOptions, Request, Response } from 'express';

import { env } from '#app/config/env.js';
import { API_PREFIX } from '#app/constants/http.js';

export const REFRESH_COOKIE_NAME = 'emr_refresh';

// httpOnly keeps the token away from JavaScript, and the path limits it to the auth endpoints.
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: env.REFRESH_COOKIE_SAMESITE,
  path: `${API_PREFIX}/auth`,
});

export const setRefreshCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieOptions(), expires: expiresAt });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
};

export const readRefreshCookie = (req: Request): string | undefined => {
  const cookies: Record<string, unknown> = req.cookies;
  const value = cookies[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};
