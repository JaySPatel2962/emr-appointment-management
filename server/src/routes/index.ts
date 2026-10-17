import { Router } from 'express';

import { healthRouter } from '#app/routes/health.routes.js';

/** Every route under /api/v1. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
