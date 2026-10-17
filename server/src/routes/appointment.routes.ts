import { Router } from 'express';

import { FRONT_DESK_ROLES, ROLES } from '#app/constants/roles.js';
import * as appointmentController from '#app/controllers/appointment.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { authorize } from '#app/middlewares/authorize.js';
import { validate } from '#app/middlewares/validate.js';
import {
  appointmentIdSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from '#app/validators/appointment.validators.js';

export const appointmentRouter = Router();

appointmentRouter.use(authenticate);

// Every role can read; the service limits doctors to their own appointments.
appointmentRouter.get('/', validate(listAppointmentsSchema), appointmentController.list);
appointmentRouter.get('/:id', validate(appointmentIdSchema), appointmentController.getById);

appointmentRouter.post(
  '/',
  authorize(...FRONT_DESK_ROLES),
  validate(createAppointmentSchema),
  appointmentController.create,
);
// Every role can update; the service limits doctors to consultation notes.
appointmentRouter.put('/:id', validate(updateAppointmentSchema), appointmentController.update);
appointmentRouter.delete(
  '/:id',
  authorize(...FRONT_DESK_ROLES),
  validate(appointmentIdSchema),
  appointmentController.cancel,
);
appointmentRouter.post(
  '/:id/arrive',
  authorize(...FRONT_DESK_ROLES),
  validate(appointmentIdSchema),
  appointmentController.arrive,
);
appointmentRouter.post(
  '/:id/complete',
  authorize(ROLES.SUPER_ADMIN, ROLES.DOCTOR),
  validate(appointmentIdSchema),
  appointmentController.complete,
);
