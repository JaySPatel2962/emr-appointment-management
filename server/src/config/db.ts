import mongoose from 'mongoose';

import { env } from '#app/config/env.js';
import { logger } from '#app/config/logger.js';

mongoose.set('strictQuery', true);

let closing = false;

// Registered only after a successful connection, so a failed startup doesn't also log a disconnect.
const watchConnection = (): void => {
  mongoose.connection.on('disconnected', () => {
    if (!closing) {
      logger.warn('MongoDB disconnected');
    }
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });
};

// autoIndex builds every model's indexes at startup, including the double-booking unique index.
// Wait for those builds and log any that failed, so a missing index never goes unnoticed.
const logFailedIndexBuilds = async (): Promise<void> => {
  const models = Object.values(mongoose.models);
  const results = await Promise.allSettled(models.map((model) => model.init()));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const reason: unknown = result.reason;
      logger.error({ err: reason, model: models[index]?.modelName }, 'MongoDB index build failed');
    }
  });
};

export const connectDb = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
      autoIndex: true,
    });
  } catch (error) {
    // MONGO_URI holds credentials, so it is never part of the message. The driver's reason (which
    // names the host but never the credentials) travels as the cause and is logged with it.
    throw new Error(
      'Could not connect to MongoDB. Check MONGO_URI (user, password and cluster host) and that ' +
        "this machine's IP address is allowed under Atlas Network Access",
      { cause: error },
    );
  }
  watchConnection();
  logger.info({ database: mongoose.connection.name }, 'MongoDB connected');
  await logFailedIndexBuilds();
};

export const disconnectDb = async (): Promise<void> => {
  closing = true;
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};
