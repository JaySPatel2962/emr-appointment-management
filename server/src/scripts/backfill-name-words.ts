import { connectDb, disconnectDb } from '#app/config/db.js';
import { logger } from '#app/config/logger.js';
import { backfillNameWords } from '#app/services/name-words-backfill.service.js';

// Fills in the searchable name words of patients and appointments saved before word search
// existed (see services/name-words-backfill.service.ts). Run once after upgrading; safe to run
// again.

const run = async (): Promise<void> => {
  await connectDb();
  try {
    const counts = await backfillNameWords();
    logger.info(counts, 'Name words backfilled');
  } finally {
    await disconnectDb();
  }
};

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Name word backfill failed');
  process.exitCode = 1;
});
