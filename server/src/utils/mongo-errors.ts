import mongoose from 'mongoose';

const DUPLICATE_KEY_ERROR_CODE = 11000;
const WRITE_CONFLICT_CODE = 112;

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

/**
 * A transaction that can be run again from the start: it lost a write conflict with a
 * concurrent transaction, or the primary stepped down in the middle.
 */
export const isTransientTransactionError = (error: unknown): boolean =>
  error instanceof mongoose.mongo.MongoError &&
  (error.hasErrorLabel('TransientTransactionError') || error.code === WRITE_CONFLICT_CODE);

/** A commit whose reply was lost: it may or may not have happened, and committing again is safe. */
export const isUnknownCommitResult = (error: unknown): boolean =>
  error instanceof mongoose.mongo.MongoError &&
  error.hasErrorLabel('UnknownTransactionCommitResult');
