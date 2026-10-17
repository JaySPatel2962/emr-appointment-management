import { Router } from 'express';

import { getHealth } from '#app/controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
