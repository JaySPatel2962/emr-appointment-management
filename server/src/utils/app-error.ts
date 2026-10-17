import { HTTP_STATUS } from '#app/constants/http.js';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** An expected failure with an HTTP status. Its message is safe to send to the client. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly details: ErrorDetail[] | undefined;

  constructor(statusCode: number, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(HTTP_STATUS.BAD_REQUEST, message, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message: string): AppError {
    return new AppError(HTTP_STATUS.CONFLICT, message);
  }

  static unprocessable(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later'): AppError {
    return new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }
}
