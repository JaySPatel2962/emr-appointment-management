import type { Request } from 'express';

import type { AuthUser } from '#app/types/auth.js';
import { AppError } from '#app/utils/app-error.js';

/** The authenticated caller. Only valid behind the `authenticate` middleware. */
export const getAuthUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
};
