const DUPLICATE_KEY_ERROR_CODE = 11000;

export interface DuplicateKeyError {
  code: typeof DUPLICATE_KEY_ERROR_CODE;
  keyPattern?: Record<string, unknown>;
}

/** True for MongoDB's E11000 error, raised when a unique index rejects a write. */
export const isDuplicateKeyError = (error: unknown): error is DuplicateKeyError =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === DUPLICATE_KEY_ERROR_CODE;

/** The indexed fields that caused a duplicate key error, e.g. ['email']. */
export const getDuplicateKeyFields = (error: DuplicateKeyError): string[] =>
  Object.keys(error.keyPattern ?? {});
