import { Router } from 'express';

import { authRouter } from '#app/routes/auth.routes.js';
import { healthRouter } from '#app/routes/health.routes.js';

/** Every route under /api/v1. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
