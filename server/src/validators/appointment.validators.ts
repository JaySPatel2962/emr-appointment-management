import { z } from 'zod';

import {
  APPOINTMENT_STATUS,
  NOTES_MAX_LENGTH,
  PURPOSE_MAX_LENGTH,
} from '#app/constants/appointment.js';
import {
  dateSchema,
  idParamsSchema,
  objectIdSchema,
  paginationQuery,
  timeSchema,
} from '#app/validators/common.js';
import { mobileSearchSchema, newPatientSchema } from '#app/validators/patient.validators.js';

/** The only fields a list can be sorted by. Anything else is rejected, never passed to MongoDB. */
export const APPOINTMENT_SORT_FIELDS = [
  'date',
  'createdAt',
  'patientName',
  'doctorName',
  'status',
] as const;

const purposeSchema = z.string().trim().min(1, 'Required').max(PURPOSE_MAX_LENGTH);
const notesSchema = z.string().trim().max(NOTES_MAX_LENGTH);

const createAppointmentBody = z
  .object({
    doctorId: objectIdSchema,
    // Optional: the department always comes from the doctor, this only cross-checks it.
    departmentId: objectIdSchema.optional(),
    date: dateSchema,
    slotStart: timeSchema,
    purpose: purposeSchema,
    notes: notesSchema.optional(),
    patientId: objectIdSchema.optional(),
    newPatient: newPatientSchema.optional(),
  })
  .refine(
    (body) => (body.patientId === undefined) !== (body.newPatient === undefined),
    'Provide either patientId (an existing patient) or newPatient, but not both',
  );

const updateAppointmentBody = z
  .object({
    purpose: purposeSchema.optional(),
    notes: notesSchema.optional(),
  })
  .refine(
    (body) => body.purpose !== undefined || body.notes !== undefined,
    'Provide purpose, notes or both',
  );

const listAppointmentsQuery = z
  .object({
    ...paginationQuery,
    sortBy: z.enum(APPOINTMENT_SORT_FIELDS).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    status: z.enum(APPOINTMENT_STATUS).optional(),
    doctorId: objectIdSchema.optional(),
    doctorName: z.string().trim().min(1).max(100).optional(),
    departmentId: objectIdSchema.optional(),
    patientName: z.string().trim().min(1).max(100).optional(),
    mobile: mobileSearchSchema.optional(),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
  })
  .refine(
    (query) =>
      query.dateFrom === undefined || query.dateTo === undefined || query.dateFrom <= query.dateTo,
    { path: ['dateTo'], error: 'Must not be before dateFrom' },
  );

export const createAppointmentSchema = z.object({ body: createAppointmentBody });
export const updateAppointmentSchema = z.object({
  params: idParamsSchema,
  body: updateAppointmentBody,
});
export const listAppointmentsSchema = z.object({ query: listAppointmentsQuery });
export const appointmentIdSchema = z.object({ params: idParamsSchema });

export type CreateAppointmentInput = z.output<typeof createAppointmentBody>;
export type UpdateAppointmentInput = z.output<typeof updateAppointmentBody>;
export type ListAppointmentsQuery = z.output<typeof listAppointmentsQuery>;
export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];
