import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';

import { logger } from '#app/config/logger.js';
import { CONFLICT_CODES } from '#app/constants/conflicts.js';
import { AppError } from '#app/utils/app-error.js';
import { isTransientTransactionError, isUnknownCommitResult } from '#app/utils/mongo-errors.js';

export const CONCURRENT_UPDATE =
  'This could not be saved because of a change made at the same moment. Try again.';

const ATTEMPTS = 2;

/** The 409 for a transaction that lost to a concurrent change on both attempts. */
export const concurrentUpdateError = (): AppError =>
  AppError.conflict(CONCURRENT_UPDATE, { code: CONFLICT_CODES.CONCURRENT_UPDATE });

/** Commits, and commits once more if the first reply was lost: committing twice is safe. */
const commit = async (session: ClientSession): Promise<void> => {
  try {
    await session.commitTransaction();
  } catch (error) {
    if (!isUnknownCommitResult(error)) {
      throw error;
    }
    await session.commitTransaction();
  }
};

/**
 * Runs `work` in a transaction. A transient error (a write conflict with a concurrent
 * transaction, a primary stepping down) runs the whole transaction once more, with fresh
 * documents, since the first attempt was rolled back. If the second attempt fails the same way,
 * the caller gets a 409 asking to try again, never the driver's error.
 *
 * Not Mongoose's `connection.transaction()`: it uses the driver's `withTransaction`, which keeps
 * retrying for up to two minutes while the request waits.
 */
export const runInTransaction = async <T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await work(session);
      await commit(session);
      return result;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      if (!isTransientTransactionError(error)) {
        throw error;
      }
      if (attempt >= ATTEMPTS) {
        logger.warn({ attempt }, 'Transaction lost to a concurrent change again; answering 409');
        throw concurrentUpdateError();
      }
      logger.warn({ attempt }, 'Transaction lost to a concurrent change; running it once more');
    } finally {
      await session.endSession();
    }
  }
};
