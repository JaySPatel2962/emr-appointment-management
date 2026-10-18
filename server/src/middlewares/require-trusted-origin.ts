import type { RequestHandler } from 'express';

import { env } from '#app/config/env.js';
import { AppError } from '#app/utils/app-error.js';

/**
 * Refuses browser requests sent from another site. The refresh cookie alone authenticates
 * /auth/refresh and /auth/logout, so without this a page elsewhere could post a form to them
 * (CSRF). Browsers send Origin with every POST; requests without it (curl, Postman, another
 * server) carry no browser cookie and pass.
 */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (origin !== undefined && origin !== env.CLIENT_URL) {
    next(AppError.forbidden('Cross-site requests are not allowed'));
    return;
  }
  next();
};
