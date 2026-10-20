import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { HTTP_STATUS } from '#app/constants/http.js';
import { AppError } from '#app/utils/app-error.js';
import type { ErrorDetail } from '#app/utils/app-error.js';
import { getDuplicateKeyFields, isDuplicateKeyError } from '#app/utils/mongo-errors.js';

/** What the error handler sends for a thrown value. */
export interface HttpError {
  statusCode: number;
  message: string;
  details?: ErrorDetail[];
  /** Extra structured detail for the response's meta. */
  meta?: Record<string, unknown>;
  /** True for errors nobody anticipated: they are logged, and their real message is hidden. */
  unexpected: boolean;
}

interface ClientHttpError {
  status: number;
  type?: unknown;
}

// Errors from express.json() (malformed JSON, oversized body) carry a 4xx status and are marked safe to expose.
const isClientHttpError = (error: unknown): error is ClientHttpError =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number' &&
  error.status >= HTTP_STATUS.BAD_REQUEST &&
  error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR &&
  'expose' in error &&
  error.expose === true;

const BODY_PARSER_MESSAGES: Partial<Record<string, string>> = {
  'entity.parse.failed': 'Malformed JSON in request body',
  'entity.too.large': 'Request body is too large',
};

const toField = (path: readonly PropertyKey[]): string => path.map(String).join('.');

const expectedError = (
  statusCode: number,
  message: string,
  details?: ErrorDetail[],
): HttpError => ({
  statusCode,
  message,
  ...(details ? { details } : {}),
  unexpected: false,
});

export const toHttpError = (error: unknown): HttpError => {
  if (error instanceof AppError) {
    return {
      ...expectedError(error.statusCode, error.message, error.details),
      ...(error.meta ? { meta: error.meta } : {}),
    };
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: toField(issue.path),
      message: issue.message,
    }));
    return expectedError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', details);
  }
  if (isDuplicateKeyError(error)) {
    const fields = getDuplicateKeyFields(error);
    const message =
      fields.length > 0
        ? `A record with the same ${fields.join(', ')} already exists`
        : 'Duplicate record';
    return expectedError(HTTP_STATUS.CONFLICT, message);
  }
  if (error instanceof mongoose.Error.CastError) {
    return expectedError(HTTP_STATUS.BAD_REQUEST, `Invalid value for ${error.path}`);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((issue) => ({
      field: issue.path,
      message: issue.message,
    }));
    return expectedError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', details);
  }
  // TokenExpiredError extends JsonWebTokenError, so it must be checked first.
  if (error instanceof jwt.TokenExpiredError) {
    return expectedError(HTTP_STATUS.UNAUTHORIZED, 'Token has expired');
  }
  if (error instanceof jwt.JsonWebTokenError) {
    return expectedError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token');
  }
  if (isClientHttpError(error)) {
    const message = typeof error.type === 'string' ? BODY_PARSER_MESSAGES[error.type] : undefined;
    return expectedError(error.status, message ?? 'Bad request');
  }
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    unexpected: true,
  };
};
