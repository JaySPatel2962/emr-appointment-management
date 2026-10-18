import { env } from '#app/config/env.js';
import * as authService from '#app/services/auth.service.js';
import type { AuthSession } from '#app/services/auth.service.js';
import { sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { getClientInfo } from '#app/utils/client-info.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from '#app/utils/refresh-cookie.js';
import { getValidated } from '#app/middlewares/validate.js';
import { loginSchema } from '#app/validators/auth.validators.js';

// The refresh token travels only in its httpOnly cookie, never in the body.
const sessionBody = (session: AuthSession) => ({
  accessToken: session.accessToken,
  tokenType: 'Bearer',
  expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  user: session.user,
});

export const login = asyncHandler(async (req, res) => {
  const { body } = getValidated(req, loginSchema);
  const session = await authService.login(body, getClientInfo(req));
  setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
  sendSuccess(res, { message: 'Logged in successfully', data: sessionBody(session) });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshCookie(req);
  try {
    const session = await authService.refresh(refreshToken, getClientInfo(req));
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    sendSuccess(res, { message: 'Session refreshed', data: sessionBody(session) });
  } catch (error) {
    // A refresh cookie that failed once will never work again, so the browser can drop it. A
    // request that brought no cookie leaves the browser's own cookie alone (see logout).
    if (refreshToken !== undefined) {
      clearRefreshCookie(res);
    }
    throw error;
  }
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshCookie(req);
  await authService.logout(refreshToken, getClientInfo(req));
  // Only a request that brought the cookie clears it. A form posted from another site arrives
  // without it (SameSite), and must not be able to sign the user out by clearing it.
  if (refreshToken !== undefined) {
    clearRefreshCookie(res);
  }
  sendSuccess(res, { message: 'Logged out successfully', data: null });
});
