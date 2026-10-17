import { Router } from 'express';

import { ROLES } from '#app/constants/roles.js';
import * as userController from '#app/controllers/user.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { authorize } from '#app/middlewares/authorize.js';
import { validate } from '#app/middlewares/validate.js';
import { createReceptionistSchema } from '#app/validators/user.validators.js';

export const userRouter = Router();

userRouter.post(
  '/receptionists',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validate(createReceptionistSchema),
  userController.createReceptionist,
);
