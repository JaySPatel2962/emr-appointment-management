import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  NOTES_MAX_LENGTH,
  PURPOSE_MAX_LENGTH,
} from '#app/constants/appointment.js';
import { lowercaseCopy } from '#app/models/plugins/lowercase-copy.js';
import { DATE_PATTERN, TIME_PATTERN } from '#app/utils/time.js';

const { ObjectId } = Schema.Types;

const appointmentSchema = new Schema(
  {
    patientId: { type: ObjectId, ref: 'Patient', required: true },
    doctorId: { type: ObjectId, ref: 'Doctor', required: true },
    departmentId: { type: ObjectId, ref: 'Department', required: true },
    // Clinic-timezone wall-clock values as strings: they sort correctly, never shift with the
    // server's timezone, and make the double-booking index an exact match.
    date: { type: String, required: true, match: DATE_PATTERN },
    slotStart: { type: String, required: true, match: TIME_PATTERN },
    slotEnd: { type: String, required: true, match: TIME_PATTERN },
    purpose: { type: String, required: true, trim: true, maxlength: PURPOSE_MAX_LENGTH },
    notes: { type: String, trim: true, maxlength: NOTES_MAX_LENGTH, default: '' },
    status: {
      type: String,
      required: true,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.SCHEDULED,
    },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    arrivedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },

    // Copied from the patient and doctor at booking time, so lists can be searched and sorted
    // without a $lookup. These values are not edited after registration in this module.
    patientCode: { type: String, required: true },
    patientName: { type: String, required: true },
    patientNameLower: { type: String, required: true },
    patientMobile: { type: String, required: true },
    doctorName: { type: String, required: true },
  },
  { timestamps: true },
);

appointmentSchema.plugin(lowercaseCopy('patientName', 'patientNameLower'));

// Double-booking guard: at most one active appointment per doctor, date and start time.
// The partial filter leaves CANCELLED appointments out of the index, so a cancelled slot can
// be booked again. Booking inserts directly and relies on this index (E11000 becomes a 409),
// so two concurrent requests for the same slot can never both succeed.
appointmentSchema.index(
  { doctorId: 1, date: 1, slotStart: 1 },
  {
    name: 'uniq_active_doctor_slot',
    unique: true,
    partialFilterExpression: { status: { $in: [...ACTIVE_APPOINTMENT_STATUSES] } },
  },
);
// A doctor's appointments for a day or a date range: the doctor's own list and slot availability.
appointmentSchema.index({ doctorId: 1, date: 1 });
// Status filter with a date range, e.g. today's SCHEDULED appointments.
appointmentSchema.index({ status: 1, date: 1 });
// Department filter with a date range.
appointmentSchema.index({ departmentId: 1, date: 1 });
// Lists filtered only by date range, sorted by date and time (the default list view).
appointmentSchema.index({ date: 1, slotStart: 1 });
// Patient search on the copied fields: anchored prefix matches use these indexes.
appointmentSchema.index({ patientMobile: 1 });
appointmentSchema.index({ patientNameLower: 1 });

export type Appointment = InferSchemaType<typeof appointmentSchema>;

export const AppointmentModel = model('Appointment', appointmentSchema);
