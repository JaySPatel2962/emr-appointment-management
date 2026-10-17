import type { RequestHandler } from 'express';

import { AppError } from '#app/utils/app-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`));
};
