import { rateLimit } from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

import { env } from '#app/config/env.js';
import { AppError } from '#app/utils/app-error.js';

const sharedOptions: Partial<Options> = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Reply through the error handler so a 429 uses the standard envelope.
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
};

/** Limits every API route per client IP. */
export const apiRateLimiter = rateLimit({ ...sharedOptions, limit: env.RATE_LIMIT_MAX });

/** Limits POST /auth/login. Only failed attempts count, which slows down password guessing. */
export const loginRateLimiter = rateLimit({
  ...sharedOptions,
  limit: env.LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
});
