import { Router } from 'express';

import { ROLES } from '#app/constants/roles.js';
import * as doctorController from '#app/controllers/doctor.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { authorize } from '#app/middlewares/authorize.js';
import { validate } from '#app/middlewares/validate.js';
import {
  createDoctorSchema,
  doctorIdSchema,
  listDoctorsSchema,
  updateScheduleSchema,
} from '#app/validators/doctor.validators.js';

export const doctorRouter = Router();

// Authentication and role checks run before validation, so callers without access learn nothing.
doctorRouter.use(authenticate);

doctorRouter.get('/', validate(listDoctorsSchema), doctorController.list);
doctorRouter.post(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  validate(createDoctorSchema),
  doctorController.create,
);
doctorRouter.get('/:id', validate(doctorIdSchema), doctorController.getById);
doctorRouter.put(
  '/:id/schedule',
  authorize(ROLES.SUPER_ADMIN),
  validate(updateScheduleSchema),
  doctorController.updateSchedule,
);
