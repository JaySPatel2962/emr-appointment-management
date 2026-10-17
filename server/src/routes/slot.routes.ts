import { Router } from 'express';

import * as slotController from '#app/controllers/slot.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { validate } from '#app/middlewares/validate.js';
import { slotsSchema } from '#app/validators/slot.validators.js';

export const slotRouter = Router();

slotRouter.get('/', authenticate, validate(slotsSchema), slotController.getDaySlots);
