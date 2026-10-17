import { HTTP_STATUS } from '#app/constants/http.js';
import { getValidated } from '#app/middlewares/validate.js';
import * as doctorService from '#app/services/doctor.service.js';
import { sendPage, sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { getAuthUser } from '#app/utils/auth-user.js';
import {
  createDoctorSchema,
  doctorIdSchema,
  listDoctorsSchema,
  updateScheduleSchema,
} from '#app/validators/doctor.validators.js';

export const list = asyncHandler(async (req, res) => {
  const { query } = getValidated(req, listDoctorsSchema);
  const page = await doctorService.listDoctors(query, getAuthUser(req));
  sendPage(res, 'Doctors retrieved', page);
});

export const getById = asyncHandler(async (req, res) => {
  const { params } = getValidated(req, doctorIdSchema);
  const doctor = await doctorService.getDoctor(params.id, getAuthUser(req));
  sendSuccess(res, { message: 'Doctor retrieved', data: doctor });
});

export const create = asyncHandler(async (req, res) => {
  const { body } = getValidated(req, createDoctorSchema);
  const doctor = await doctorService.createDoctor(body, getAuthUser(req));
  sendSuccess(res, { status: HTTP_STATUS.CREATED, message: 'Doctor created', data: doctor });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const { params, body } = getValidated(req, updateScheduleSchema);
  const doctor = await doctorService.updateSchedule(params.id, body, getAuthUser(req));
  sendSuccess(res, { message: 'Schedule updated', data: doctor });
});
