import type { ErrorRequestHandler } from 'express';

import { env } from '#app/config/env.js';
import { sendResponse } from '#app/utils/api-response.js';
import { toHttpError } from '#app/utils/http-error.js';

/** Sends every error in the standard envelope. Unexpected errors become a generic 500. */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { statusCode, message, details, meta, unexpected } = toHttpError(error);
  if (unexpected) {
    // The request logger writes it once, together with the request id, method and path.
    res.err = error instanceof Error ? error : new Error(String(error));
  }

  const stack =
    unexpected && env.NODE_ENV === 'development' && error instanceof Error
      ? error.stack
      : undefined;

  sendResponse(res, {
    status: statusCode,
    success: false,
    message,
    data: null,
    meta: {
      requestId: req.id,
      ...meta,
      ...(details ? { errors: details } : {}),
      ...(stack ? { stack } : {}),
    },
  });
};
