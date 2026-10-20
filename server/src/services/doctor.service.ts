import mongoose from 'mongoose';
import type { QueryFilter, Types } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import { CONFLICT_CODES } from '#app/constants/conflicts.js';
import { ROLES } from '#app/constants/roles.js';
import { DepartmentModel } from '#app/models/department.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import type { Doctor } from '#app/models/doctor.model.js';
import { recordAudit } from '#app/services/audit.service.js';
import { getDepartmentsById, toDepartmentDto } from '#app/services/department.service.js';
import {
  findStrandedAppointments,
  strandedAppointmentsError,
} from '#app/services/schedule-fit.service.js';
import type { DepartmentDto } from '#app/services/department.service.js';
import { buildStaffAccount } from '#app/services/user.service.js';
import type { AuthUser } from '#app/types/auth.js';
import { isDoctor, requireDoctorId } from '#app/utils/access.js';
import { AppError } from '#app/utils/app-error.js';
import { toObjectId } from '#app/utils/object-id.js';
import { pageSkip, toPage } from '#app/utils/pagination.js';
import type { Page } from '#app/utils/pagination.js';
import { containsRegex } from '#app/utils/regex.js';
import type { DaySchedule } from '#app/utils/schedule.js';
import type {
  CreateDoctorInput,
  ListDoctorsQuery,
  UpdateScheduleInput,
} from '#app/validators/doctor.validators.js';

export interface DoctorDto {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  department: DepartmentDto;
  slotDurationMinutes: number;
  schedule: DaySchedule[];
  /** Goes up with every saved schedule change; send it back when changing the schedule. */
  scheduleVersion: number;
}

interface DoctorRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  name: string;
  specialization: string;
  slotDurationMinutes: number;
  schedule: readonly DaySchedule[];
  scheduleVersion?: number;
}

const DOCTOR_NOT_FOUND = 'Doctor not found';
export const SCHEDULE_STALE = 'The schedule changed since you opened it. Reload to see the latest.';

// Doctors saved before schedule versions existed have no scheduleVersion: they are at version 0.
const versionOf = (doctor: { scheduleVersion?: number | undefined }): number =>
  doctor.scheduleVersion ?? 0;

const atVersion = (version: number): QueryFilter<Doctor> =>
  version === 0 ? { scheduleVersion: { $in: [0, null] } } : { scheduleVersion: version };

/** The 409 for a save based on an older version, with the version to reload. */
const staleScheduleError = (currentVersion: number): AppError =>
  AppError.conflict(SCHEDULE_STALE, {
    code: CONFLICT_CODES.SCHEDULE_STALE,
    scheduleVersion: currentVersion,
  });

const toPlainSchedule = (schedule: readonly DaySchedule[]): DaySchedule[] =>
  schedule.map(({ dayOfWeek, sessions, breaks }) => ({
    dayOfWeek,
    sessions: sessions.map(({ start, end }) => ({ start, end })),
    breaks: breaks.map(({ start, end }) => ({ start, end })),
  }));

const toDoctorDto = (doctor: DoctorRecord, department: DepartmentDto): DoctorDto => ({
  id: doctor._id.toString(),
  userId: doctor.userId.toString(),
  name: doctor.name,
  specialization: doctor.specialization,
  department,
  slotDurationMinutes: doctor.slotDurationMinutes,
  schedule: toPlainSchedule(doctor.schedule),
  scheduleVersion: versionOf(doctor),
});

/** Adds each doctor's department, loading all of them in one query. */
const toDoctorDtos = async (doctors: readonly DoctorRecord[]): Promise<DoctorDto[]> => {
  const departments = await getDepartmentsById(doctors.map((doctor) => doctor.departmentId));
  return doctors.map((doctor) => {
    const departmentId = doctor.departmentId.toString();
    return toDoctorDto(doctor, departments.get(departmentId) ?? { id: departmentId, name: '' });
  });
};

const toSingleDoctorDto = async (doctor: DoctorRecord): Promise<DoctorDto> => {
  const [dto] = await toDoctorDtos([doctor]);
  if (!dto) {
    throw new Error('Doctor could not be mapped');
  }
  return dto;
};

/** Doctors only ever see their own profile; everyone else sees all. */
const doctorScope = (actor: AuthUser): QueryFilter<Doctor> =>
  isDoctor(actor) ? { _id: toObjectId(requireDoctorId(actor)) } : {};

export const listDoctors = async (
  query: ListDoctorsQuery,
  actor: AuthUser,
): Promise<Page<DoctorDto>> => {
  // Case-insensitive "contains" on name or specialization. A scan is fine at doctor-list size.
  const search = query.search === undefined ? undefined : containsRegex(query.search);
  const filter: QueryFilter<Doctor> = {
    ...doctorScope(actor),
    ...(query.departmentId === undefined ? {} : { departmentId: toObjectId(query.departmentId) }),
    ...(search === undefined ? {} : { $or: [{ name: search }, { specialization: search }] }),
  };
  const [doctors, total] = await Promise.all([
    DoctorModel.find(filter).sort({ name: 1 }).skip(pageSkip(query)).limit(query.limit).lean(),
    // Without a filter (no department, no search, not a doctor), the total comes from metadata.
    Object.keys(filter).length === 0
      ? DoctorModel.estimatedDocumentCount()
      : DoctorModel.countDocuments(filter),
  ]);
  return toPage(await toDoctorDtos(doctors), total, query);
};

export const getDoctor = async (id: string, actor: AuthUser): Promise<DoctorDto> => {
  // $and, not a spread: the doctor scope is also an _id condition and would replace this one.
  const doctor = await DoctorModel.findOne({
    $and: [{ _id: toObjectId(id) }, doctorScope(actor)],
  }).lean();
  if (!doctor) {
    throw AppError.notFound(DOCTOR_NOT_FOUND);
  }
  return toSingleDoctorDto(doctor);
};

/** Creates the doctor's user account and profile together: both are saved, or neither is. */
export const createDoctor = async (
  input: CreateDoctorInput,
  actor: AuthUser,
): Promise<DoctorDto> => {
  const department = await DepartmentModel.findById(input.departmentId, { name: 1 }).lean();
  if (!department) {
    throw AppError.unprocessable('Department not found');
  }
  const account = await buildStaffAccount(input, ROLES.DOCTOR);

  const doctor = await mongoose.connection.transaction(async (session) => {
    const user = await account.save({ session });
    const [profile] = await DoctorModel.create(
      [
        {
          userId: user._id,
          departmentId: department._id,
          name: user.name,
          specialization: input.specialization,
          slotDurationMinutes: input.slotDurationMinutes,
          schedule: input.schedule,
        },
      ],
      { session },
    );
    if (!profile) {
      throw new Error('Doctor profile was not created');
    }
    return profile;
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CREATE,
    entity: AUDIT_ENTITIES.DOCTOR,
    entityId: doctor._id,
    actor,
    metadata: { userId: doctor.userId.toString() },
  });
  return toDoctorDto(doctor.toObject(), toDepartmentDto(department));
};

/**
 * Replaces a doctor's weekly schedule and, optionally, the slot length. A change that would
 * leave an appointment still to happen (SCHEDULED or ARRIVED, dated today or later) without a
 * slot of the same date, start and end is refused with a 409 that lists those appointments.
 *
 * A booking racing this change was checked against the old schedule, so the check runs again
 * once the new one is saved. Each side writes before it reads (the booking re-checks its slot
 * after saving, see createAppointment), so of a booking and a change made at the same moment at
 * least one sees the other, and the stranding one is undone.
 */
export const updateSchedule = async (
  id: string,
  input: UpdateScheduleInput,
  actor: AuthUser,
): Promise<DoctorDto> => {
  const current = await DoctorModel.findById(id, {
    schedule: 1,
    slotDurationMinutes: 1,
    scheduleVersion: 1,
  }).lean();
  if (!current) {
    throw AppError.notFound(DOCTOR_NOT_FOUND);
  }
  // Optimistic concurrency: a change based on an older version would silently undo whatever
  // was saved since it was loaded. The client reloads and makes its change again.
  if (versionOf(current) !== input.scheduleVersion) {
    throw staleScheduleError(versionOf(current));
  }
  const slotDurationMinutes = input.slotDurationMinutes ?? current.slotDurationMinutes;
  const stranded = await findStrandedAppointments(current._id, input.schedule, slotDurationMinutes);
  if (stranded.length > 0) {
    throw strandedAppointmentsError(stranded);
  }

  const changes = {
    schedule: input.schedule,
    ...(input.slotDurationMinutes === undefined
      ? {}
      : { slotDurationMinutes: input.slotDurationMinutes }),
  };
  // Written only if the version is still the one checked above: of two saves of the same
  // version, exactly one gets through.
  const doctor = await DoctorModel.findOneAndUpdate(
    { _id: current._id, ...atVersion(input.scheduleVersion) },
    { $set: changes, $inc: { scheduleVersion: 1 } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!doctor) {
    const latest = await DoctorModel.findById(id, { scheduleVersion: 1 }).lean();
    if (!latest) {
      throw AppError.notFound(DOCTOR_NOT_FOUND);
    }
    throw staleScheduleError(versionOf(latest));
  }

  const late = await findStrandedAppointments(
    doctor._id,
    doctor.schedule,
    doctor.slotDurationMinutes,
  );
  if (late.length > 0) {
    // Put the previous schedule back, unless another change has replaced this one since.
    await DoctorModel.updateOne(
      { _id: doctor._id, scheduleVersion: doctor.scheduleVersion },
      {
        $set: { schedule: current.schedule, slotDurationMinutes: current.slotDurationMinutes },
        $inc: { scheduleVersion: 1 },
      },
    );
    throw strandedAppointmentsError(late);
  }

  await recordAudit({
    action: AUDIT_ACTIONS.UPDATE,
    entity: AUDIT_ENTITIES.DOCTOR,
    entityId: doctor._id,
    actor,
    metadata: { fields: Object.keys(changes) },
  });
  return toSingleDoctorDto(doctor);
};
