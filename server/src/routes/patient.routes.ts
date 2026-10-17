import { Router } from 'express';

import { FRONT_DESK_ROLES } from '#app/constants/roles.js';
import * as patientController from '#app/controllers/patient.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { authorize } from '#app/middlewares/authorize.js';
import { validate } from '#app/middlewares/validate.js';
import { searchPatientsSchema } from '#app/validators/patient.validators.js';

export const patientRouter = Router();

patientRouter.get(
  '/',
  authenticate,
  authorize(...FRONT_DESK_ROLES),
  validate(searchPatientsSchema),
  patientController.search,
);
