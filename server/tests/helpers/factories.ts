import { Types } from 'mongoose';

import { GENDERS } from '#app/constants/patient.js';
import { ROLES } from '#app/constants/roles.js';
import type { Role } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import type { Appointment } from '#app/models/appointment.model.js';
import { DepartmentModel } from '#app/models/department.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import type { Patient } from '#app/models/patient.model.js';
import { UserModel } from '#app/models/user.model.js';
import { hashPassword } from '#app/services/password.service.js';
import type { DaySchedule } from '#app/utils/schedule.js';

export const TEST_PASSWORD = 'Password123';

let counter = 0;
const nextNumber = (): number => {
  counter += 1;
  return counter;
};

/** Every day of the week: 09:00-12:00 and 13:00-17:00, with lunch in between. */
export const FULL_WEEK_SCHEDULE: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  sessions: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  breaks: [{ start: '12:00', end: '13:00' }],
}));

interface UserOptions {
  name?: string;
  email?: string;
  isActive?: boolean;
}

export const createUser = async (role: Role, options: UserOptions = {}) =>
  UserModel.create({
    name: options.name ?? `Test User ${nextNumber()}`,
    email: options.email ?? `user${nextNumber()}@clinic.test`,
    passwordHash: await hashPassword(TEST_PASSWORD),
    role,
    isActive: options.isActive ?? true,
  });

export const createDepartment = (name = `Department ${nextNumber()}`) =>
  DepartmentModel.create({ name });

interface DoctorOptions {
  departmentId?: Types.ObjectId;
  name?: string;
  slotDurationMinutes?: number;
  schedule?: DaySchedule[];
}

export const createDoctor = async (options: DoctorOptions = {}) => {
  const departmentId = options.departmentId ?? (await createDepartment())._id;
  const user = await createUser(ROLES.DOCTOR, { name: options.name ?? `Dr. Test ${nextNumber()}` });
  const doctor = await DoctorModel.create({
    userId: user._id,
    departmentId,
    name: user.name,
    specialization: 'General Medicine',
    slotDurationMinutes: options.slotDurationMinutes ?? 15,
    schedule: options.schedule ?? FULL_WEEK_SCHEDULE,
  });
  return { user, doctor };
};

/** Test patients get codes like PAT-T7, which never collide with codes from the counter. */
export const createPatient = (overrides: Partial<Patient> = {}) =>
  PatientModel.create({
    patientCode: `PAT-T${nextNumber()}`,
    name: 'Asha Rao',
    mobile: '9876543210',
    gender: GENDERS.FEMALE,
    ...overrides,
  });

interface AppointmentDoctor {
  _id: Types.ObjectId;
  departmentId: Types.ObjectId;
  name: string;
}

/**
 * Inserts an appointment directly, without booking rules: for arranging test data only. A real
 * patient is created to match, so the copied patient fields agree with the patient record.
 */
export const createAppointment = async (
  doctor: AppointmentDoctor,
  overrides: Partial<Appointment> = {},
) => {
  const patient = await createPatient({
    name: overrides.patientName ?? 'Asha Rao',
    mobile: overrides.patientMobile ?? '9876543210',
  });
  return AppointmentModel.create({
    patientId: patient._id,
    doctorId: doctor._id,
    departmentId: doctor.departmentId,
    date: '2030-01-15',
    slotStart: '13:30',
    slotEnd: '14:00',
    purpose: 'Follow-up',
    createdBy: new Types.ObjectId(),
    patientCode: patient.patientCode,
    patientName: patient.name,
    patientMobile: patient.mobile,
    doctorName: doctor.name,
    ...overrides,
  });
};
