import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';

import { env } from '#app/config/env.js';
import { API_PREFIX } from '#app/constants/http.js';
import { errorHandler } from '#app/middlewares/error-handler.js';
import { notFound } from '#app/middlewares/not-found.js';
import { apiRateLimiter } from '#app/middlewares/rate-limit.js';
import { requestId } from '#app/middlewares/request-id.js';
import { requestLogger } from '#app/middlewares/request-logger.js';
import { sanitizeInput } from '#app/middlewares/sanitize-input.js';
import { apiRouter } from '#app/routes/index.js';

/** Builds the Express app. Kept separate from server.ts so tests can run it without a network port. */
export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  // Flat query objects only: `?a[b]=1` is never parsed into a nested object.
  app.set('query parser', 'simple');

  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet());
  // A list (not a plain string) makes cors send Access-Control-Allow-Origin only to allowed origins.
  app.use(cors({ origin: [env.CLIENT_URL], credentials: true }));
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.use(API_PREFIX, apiRateLimiter, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
