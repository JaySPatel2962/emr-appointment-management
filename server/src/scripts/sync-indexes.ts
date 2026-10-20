import { connectDb, disconnectDb } from '#app/config/db.js';
import { logger } from '#app/config/logger.js';
import * as models from '#app/models/index.js';

// Makes the database's indexes match the models. Startup only creates missing indexes, so an
// index a model no longer defines (for example one replaced by a longer one) stays until this
// drops it. Run it once after upgrading. Safe to run again: it changes nothing when in sync.

const run = async (): Promise<void> => {
  await connectDb();
  try {
    for (const model of Object.values(models)) {
      const dropped = await model.syncIndexes();
      logger.info({ model: model.modelName, dropped }, 'Indexes in sync');
    }
  } finally {
    await disconnectDb();
  }
};

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Index sync failed');
  process.exitCode = 1;
});
