import type { RequestHandler } from 'express';

import type { Role } from '#app/constants/roles.js';
import { AppError } from '#app/utils/app-error.js';

/** Allows only the given roles. Use after `authenticate`. */
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
