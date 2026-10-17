import { HTTP_STATUS } from '#app/constants/http.js';
import { getValidated } from '#app/middlewares/validate.js';
import * as appointmentService from '#app/services/appointment.service.js';
import type { AppointmentDto } from '#app/services/appointment.service.js';
import type { AuthUser } from '#app/types/auth.js';
import { sendPage, sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { getAuthUser } from '#app/utils/auth-user.js';
import {
  appointmentIdSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from '#app/validators/appointment.validators.js';

export const create = asyncHandler(async (req, res) => {
  const { body } = getValidated(req, createAppointmentSchema);
  const appointment = await appointmentService.createAppointment(body, getAuthUser(req));
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message: 'Appointment booked',
    data: appointment,
  });
});

export const list = asyncHandler(async (req, res) => {
  const { query } = getValidated(req, listAppointmentsSchema);
  const page = await appointmentService.listAppointments(query, getAuthUser(req));
  sendPage(res, 'Appointments retrieved', page);
});

export const getById = asyncHandler(async (req, res) => {
  const { params } = getValidated(req, appointmentIdSchema);
  const appointment = await appointmentService.getAppointment(params.id, getAuthUser(req));
  sendSuccess(res, { message: 'Appointment retrieved', data: appointment });
});

export const update = asyncHandler(async (req, res) => {
  const { params, body } = getValidated(req, updateAppointmentSchema);
  const appointment = await appointmentService.updateAppointment(params.id, body, getAuthUser(req));
  sendSuccess(res, { message: 'Appointment updated', data: appointment });
});

const statusChange = (
  change: (id: string, actor: AuthUser) => Promise<AppointmentDto>,
  message: string,
) =>
  asyncHandler(async (req, res) => {
    const { params } = getValidated(req, appointmentIdSchema);
    sendSuccess(res, { message, data: await change(params.id, getAuthUser(req)) });
  });

export const cancel = statusChange(appointmentService.cancelAppointment, 'Appointment cancelled');
export const arrive = statusChange(appointmentService.markArrived, 'Patient marked as arrived');
export const complete = statusChange(
  appointmentService.completeAppointment,
  'Appointment completed',
);
