import mongoose from 'mongoose';
import type { QueryFilter, SortOrder, Types } from 'mongoose';

import { APPOINTMENT_STATUS, STATUS_TRANSITIONS } from '#app/constants/appointment.js';
import type { AppointmentStatus } from '#app/constants/appointment.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import type { AuditAction } from '#app/constants/audit.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import type { Appointment } from '#app/models/appointment.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { recordAudit } from '#app/services/audit.service.js';
import {
  createPatientRecord,
  reservePatientCode,
  toPatientDto,
} from '#app/services/patient.service.js';
import type { PatientDto, PatientRecord } from '#app/services/patient.service.js';
import { findSchedulingDoctor, resolveBookableSlot } from '#app/services/slot.service.js';
import type { AuthUser } from '#app/types/auth.js';
import { isDoctor, requireDoctorId } from '#app/utils/access.js';
import { AppError } from '#app/utils/app-error.js';
import { mobileSearchPrefix } from '#app/utils/mobile.js';
import { getDuplicateKeyFields, isDuplicateKeyError } from '#app/utils/mongo-errors.js';
import { toObjectId } from '#app/utils/object-id.js';
import { pageSkip, toPage } from '#app/utils/pagination.js';
import type { Page } from '#app/utils/pagination.js';
import { containsRegex, prefixRegex } from '#app/utils/regex.js';
import type {
  AppointmentSortField,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '#app/validators/appointment.validators.js';
import type { NewPatientInput } from '#app/validators/patient.validators.js';

const APPOINTMENT_NOT_FOUND = 'Appointment not found';
const SLOT_TAKEN = 'Slot already booked';

export interface AppointmentDto {
  id: string;
  patient: { id: string; patientCode: string; name: string; mobile: string };
  doctor: { id: string; name: string };
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  purpose: string;
  notes: string;
  status: AppointmentStatus;
  createdBy: string;
  arrivedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One appointment with the patient's full details, for the detail view. */
export type AppointmentDetailDto = Omit<AppointmentDto, 'patient'> & { patient: PatientDto };

interface AppointmentRecord {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  departmentId: Types.ObjectId;
  date: string;
  slotStart: string;
  slotEnd: string;
  purpose: string;
  notes?: string | null | undefined;
  status: AppointmentStatus;
  createdBy: Types.ObjectId;
  arrivedAt?: Date | null | undefined;
  completedAt?: Date | null | undefined;
  cancelledAt?: Date | null | undefined;
  patientCode: string;
  patientName: string;
  patientMobile: string;
  doctorName: string;
  createdAt: Date;
  updatedAt: Date;
}

type StatusChange = Exclude<AppointmentStatus, typeof APPOINTMENT_STATUS.SCHEDULED>;

// What goes with each status change: the timestamp it sets, its audit action, and its wording.
const STATUS_CHANGES: Record<
  StatusChange,
  { timestamp: 'arrivedAt' | 'completedAt' | 'cancelledAt'; action: AuditAction; verb: string }
> = {
  [APPOINTMENT_STATUS.ARRIVED]: {
    timestamp: 'arrivedAt',
    action: AUDIT_ACTIONS.ARRIVE,
    verb: 'marked as arrived',
  },
  [APPOINTMENT_STATUS.COMPLETED]: {
    timestamp: 'completedAt',
    action: AUDIT_ACTIONS.COMPLETE,
    verb: 'completed',
  },
  [APPOINTMENT_STATUS.CANCELLED]: {
    timestamp: 'cancelledAt',
    action: AUDIT_ACTIONS.CANCEL,
    verb: 'cancelled',
  },
};

// The purpose can change until the visit is over. Consultation notes can also be written after
// it; nothing changes once an appointment is cancelled.
const PURPOSE_EDITABLE: AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
];
const NOTES_EDITABLE: AppointmentStatus[] = [...PURPOSE_EDITABLE, APPOINTMENT_STATUS.COMPLETED];

// API sort field -> stored field. Patient names sort by their lowercase copy, ignoring case.
const SORT_FIELDS: Record<AppointmentSortField, string> = {
  date: 'date',
  createdAt: 'createdAt',
  patientName: 'patientNameLower',
  doctorName: 'doctorName',
  status: 'status',
};

export const toAppointmentDto = (appointment: AppointmentRecord): AppointmentDto => ({
  id: appointment._id.toString(),
  patient: {
    id: appointment.patientId.toString(),
    patientCode: appointment.patientCode,
    name: appointment.patientName,
    mobile: appointment.patientMobile,
  },
  doctor: { id: appointment.doctorId.toString(), name: appointment.doctorName },
  departmentId: appointment.departmentId.toString(),
  date: appointment.date,
  slotStart: appointment.slotStart,
  slotEnd: appointment.slotEnd,
  purpose: appointment.purpose,
  notes: appointment.notes ?? '',
  status: appointment.status,
  createdBy: appointment.createdBy.toString(),
  arrivedAt: appointment.arrivedAt ?? null,
  completedAt: appointment.completedAt ?? null,
  cancelledAt: appointment.cancelledAt ?? null,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt,
});

/** Doctors only ever reach their own appointments. The filter is forced here, not by callers. */
const appointmentScope = (actor: AuthUser): QueryFilter<Appointment> =>
  isDoctor(actor) ? { doctorId: toObjectId(requireDoctorId(actor)) } : {};

const byIdInScope = (id: string, actor: AuthUser): QueryFilter<Appointment> => ({
  $and: [{ _id: toObjectId(id) }, appointmentScope(actor)],
});

const statusesLeadingTo = (target: AppointmentStatus): AppointmentStatus[] =>
  Object.values(APPOINTMENT_STATUS).filter((from) => STATUS_TRANSITIONS[from].includes(target));

interface Booking {
  appointment: AppointmentRecord;
  newPatient?: PatientRecord;
}

type AppointmentFor = (patient: PatientRecord) => Partial<Appointment>;

const bookExistingPatient = async (
  patientId: string,
  appointmentFor: AppointmentFor,
): Promise<Booking> => {
  const patient = await PatientModel.findById(patientId).lean();
  if (!patient) {
    throw AppError.notFound('Patient not found');
  }
  // A single insert, nothing checked first: the unique index decides between racing bookings.
  return { appointment: await AppointmentModel.create(appointmentFor(patient)) };
};

/**
 * Registers the patient and books the slot in one transaction: if the slot turns out to be
 * taken, the transaction aborts and no patient record is left behind. The patient code is
 * reserved before the transaction, so the shared counter never becomes a point of contention;
 * a failed booking just leaves a gap in the codes.
 */
const bookNewPatient = async (
  input: NewPatientInput,
  appointmentFor: AppointmentFor,
): Promise<Booking> => {
  const patientCode = await reservePatientCode();
  return mongoose.connection.transaction(async (session) => {
    const patient = await createPatientRecord(input, patientCode, session);
    const [appointment] = await AppointmentModel.create([appointmentFor(patient)], { session });
    if (!appointment) {
      throw new Error('Appointment was not created');
    }
    return { appointment, newPatient: patient };
  });
};

const bookPatient = (input: CreateAppointmentInput, appointmentFor: AppointmentFor) => {
  if (input.newPatient !== undefined) {
    return bookNewPatient(input.newPatient, appointmentFor);
  }
  if (input.patientId !== undefined) {
    return bookExistingPatient(input.patientId, appointmentFor);
  }
  throw AppError.badRequest('Provide either patientId or newPatient');
};

export const createAppointment = async (
  input: CreateAppointmentInput,
  actor: AuthUser,
): Promise<AppointmentDto> => {
  const doctor = await findSchedulingDoctor(input.doctorId);
  if (input.departmentId !== undefined && input.departmentId !== doctor.departmentId.toString()) {
    throw AppError.unprocessable('The doctor does not belong to this department');
  }
  // Only a slot the doctor's schedule offers, and one that hasn't started yet.
  const slot = resolveBookableSlot(doctor, input.date, input.slotStart);

  const appointmentFor: AppointmentFor = (patient) => ({
    patientId: patient._id,
    doctorId: doctor._id,
    departmentId: doctor.departmentId,
    date: input.date,
    slotStart: slot.start,
    slotEnd: slot.end,
    purpose: input.purpose,
    notes: input.notes ?? '',
    createdBy: toObjectId(actor.id),
    patientCode: patient.patientCode,
    patientName: patient.name,
    patientMobile: patient.mobile,
    doctorName: doctor.name,
  });

  let booking: Booking;
  try {
    booking = await bookPatient(input, appointmentFor);
  } catch (error) {
    // Bookings raced for this slot, and the unique index let exactly one of them through.
    if (isDuplicateKeyError(error) && getDuplicateKeyFields(error).includes('slotStart')) {
      throw AppError.conflict(SLOT_TAKEN);
    }
    throw error;
  }

  if (booking.newPatient) {
    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.PATIENT,
      entityId: booking.newPatient._id,
      actor,
    });
  }
  await recordAudit({
    action: AUDIT_ACTIONS.CREATE,
    entity: AUDIT_ENTITIES.APPOINTMENT,
    entityId: booking.appointment._id,
    actor,
    metadata: { doctorId: input.doctorId, date: input.date, slotStart: slot.start },
  });
  return toAppointmentDto(booking.appointment);
};

const findDoctorIdsByName = async (name: string): Promise<Types.ObjectId[]> => {
  const doctors = await DoctorModel.find({ name: containsRegex(name) }, { _id: 1 }).lean();
  return doctors.map((doctor) => doctor._id);
};

const buildListFilter = async (
  query: ListAppointmentsQuery,
  actor: AuthUser,
): Promise<QueryFilter<Appointment>> => {
  // Separate conditions joined by $and, so no filter can overwrite another one's field.
  const conditions: QueryFilter<Appointment>[] = [appointmentScope(actor)];
  if (query.status !== undefined) {
    conditions.push({ status: query.status });
  }
  if (query.departmentId !== undefined) {
    conditions.push({ departmentId: toObjectId(query.departmentId) });
  }
  if (query.dateFrom !== undefined) {
    conditions.push({ date: { $gte: query.dateFrom } });
  }
  if (query.dateTo !== undefined) {
    conditions.push({ date: { $lte: query.dateTo } });
  }
  if (query.patientName !== undefined) {
    conditions.push({ patientNameLower: prefixRegex(query.patientName.toLowerCase()) });
  }
  if (query.mobile !== undefined) {
    conditions.push({ patientMobile: prefixRegex(mobileSearchPrefix(query.mobile)) });
  }
  // A doctor's scope already fixes the doctor, so these filters only apply to other roles.
  if (!isDoctor(actor)) {
    if (query.doctorId !== undefined) {
      conditions.push({ doctorId: toObjectId(query.doctorId) });
    }
    if (query.doctorName !== undefined) {
      conditions.push({ doctorId: { $in: await findDoctorIdsByName(query.doctorName) } });
    }
  }
  return { $and: conditions };
};

export const listAppointments = async (
  query: ListAppointmentsQuery,
  actor: AuthUser,
): Promise<Page<AppointmentDto>> => {
  const filter = await buildListFilter(query, actor);
  const direction: SortOrder = query.sortOrder === 'asc' ? 1 : -1;
  // Same-day appointments sort by time, and _id breaks ties so pages never overlap.
  const sort: Record<string, SortOrder> = {
    [SORT_FIELDS[query.sortBy]]: direction,
    ...(query.sortBy === 'date' ? { slotStart: direction } : {}),
    _id: direction,
  };
  const [appointments, total] = await Promise.all([
    AppointmentModel.find(filter)
      .select('-patientNameLower -__v')
      .sort(sort)
      .skip(pageSkip(query))
      .limit(query.limit)
      .lean(),
    AppointmentModel.countDocuments(filter),
  ]);
  return toPage(appointments.map(toAppointmentDto), total, query);
};

export const getAppointment = async (
  id: string,
  actor: AuthUser,
): Promise<AppointmentDetailDto> => {
  const appointment = await AppointmentModel.findOne(byIdInScope(id, actor)).lean();
  if (!appointment) {
    throw AppError.notFound(APPOINTMENT_NOT_FOUND);
  }
  const patient = await PatientModel.findById(appointment.patientId).lean();
  if (!patient) {
    throw new Error(`Appointment ${id} refers to a missing patient`);
  }
  return { ...toAppointmentDto(appointment), patient: toPatientDto(patient) };
};

/** Why an update matched nothing: the appointment doesn't exist for this caller, or its status forbids it. */
const explainRejectedChange = async (
  id: string,
  actor: AuthUser,
  verb: string,
): Promise<AppError> => {
  const current = await AppointmentModel.findOne(byIdInScope(id, actor), { status: 1 }).lean();
  return current
    ? AppError.conflict(`This appointment is ${current.status.toLowerCase()} and cannot be ${verb}`)
    : AppError.notFound(APPOINTMENT_NOT_FOUND);
};

export const updateAppointment = async (
  id: string,
  input: UpdateAppointmentInput,
  actor: AuthUser,
): Promise<AppointmentDto> => {
  if (isDoctor(actor) && input.purpose !== undefined) {
    throw AppError.forbidden('Doctors can only update consultation notes');
  }
  const changes = {
    ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
  };
  const editable = input.purpose === undefined ? NOTES_EDITABLE : PURPOSE_EDITABLE;

  // The status check and the change are one atomic update, so a concurrent cancel can't slip in.
  const updated = await AppointmentModel.findOneAndUpdate(
    { $and: [byIdInScope(id, actor), { status: { $in: editable } }] },
    { $set: changes },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!updated) {
    throw await explainRejectedChange(id, actor, 'updated');
  }

  // Only the names of the changed fields: clinical text stays out of the audit log.
  await recordAudit({
    action: AUDIT_ACTIONS.UPDATE,
    entity: AUDIT_ENTITIES.APPOINTMENT,
    entityId: updated._id,
    actor,
    metadata: { fields: Object.keys(changes) },
  });
  return toAppointmentDto(updated);
};

/**
 * Moves an appointment along the workflow. The allowed source statuses are part of the update
 * filter, so the check and the change are one atomic step: of two receptionists acting at
 * once, only one succeeds.
 */
const changeStatus = async (
  id: string,
  target: StatusChange,
  actor: AuthUser,
): Promise<AppointmentDto> => {
  const change = STATUS_CHANGES[target];
  const updated = await AppointmentModel.findOneAndUpdate(
    { $and: [byIdInScope(id, actor), { status: { $in: statusesLeadingTo(target) } }] },
    { $set: { status: target, [change.timestamp]: new Date() } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) {
    throw await explainRejectedChange(id, actor, change.verb);
  }

  await recordAudit({
    action: change.action,
    entity: AUDIT_ENTITIES.APPOINTMENT,
    entityId: updated._id,
    actor,
  });
  return toAppointmentDto(updated);
};

export const markArrived = (id: string, actor: AuthUser): Promise<AppointmentDto> =>
  changeStatus(id, APPOINTMENT_STATUS.ARRIVED, actor);

export const completeAppointment = (id: string, actor: AuthUser): Promise<AppointmentDto> =>
  changeStatus(id, APPOINTMENT_STATUS.COMPLETED, actor);

/** A soft cancel: the appointment stays on record, and its slot can be booked again. */
export const cancelAppointment = (id: string, actor: AuthUser): Promise<AppointmentDto> =>
  changeStatus(id, APPOINTMENT_STATUS.CANCELLED, actor);
