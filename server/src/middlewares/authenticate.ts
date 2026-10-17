import type { RequestHandler } from 'express';

import { verifyAccessToken } from '#app/services/token.service.js';
import { AppError } from '#app/utils/app-error.js';

const BEARER_PREFIX = 'Bearer ';

/** Requires a valid access token in `Authorization: Bearer <token>` and sets `req.user`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith(BEARER_PREFIX)) {
    next(AppError.unauthorized());
    return;
  }
  // An invalid or expired token throws; the error handler answers 401.
  req.user = verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());
  next();
};
