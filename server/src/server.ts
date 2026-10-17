import { createServer } from 'node:http';

import { createApp } from '#app/app.js';
import { connectDb, disconnectDb } from '#app/config/db.js';
import { env } from '#app/config/env.js';
import { logger } from '#app/config/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const start = async (): Promise<void> => {
  await connectDb();

  const server = createServer(createApp());
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    // Exit anyway if open connections do not close in time.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    // Stop accepting connections, let in-flight requests finish, then close the database.
    server.close(() => {
      disconnectDb()
        .then(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Error while closing MongoDB');
          process.exit(1);
        });
    });
    server.closeIdleConnections();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start the API');
  process.exit(1);
});
