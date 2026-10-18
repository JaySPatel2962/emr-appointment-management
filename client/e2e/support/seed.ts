import { arrive, book, cancel, complete, signInToApi } from './api';
import type { ApiAppointment, ApiClient } from './api';
import { addDays, nextDateOn, suiteDate } from './dates';
import type { SeedInfo, SeededDoctor, SeededPatient } from './env';
import {
  ADMIN,
  ARJUN,
  KAVYA,
  MONDAY_TO_SATURDAY,
  PATIENT_KEYS,
  PATIENTS,
  RECEPTIONIST,
} from './seed-data';
import type { DoctorSeed, PatientKey } from './seed-data';

const PURPOSES = [
  'Follow-up after ECG',
  'Blood pressure review',
  'Chest pain review',
  'Medication review',
  'Annual check-up',
  'Reports review',
] as const;

/** Dr. Mehta's 18 appointments on the list's first day, and Dr. Rao's 7 on the second. */
// prettier-ignore
const KAVYA_LIST_TIMES = [
  '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15',
  '11:30', '11:45', '13:00', '13:15', '13:30', '13:45', '17:00', '17:15',
] as const;
const ARJUN_LIST_TIMES = ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00'] as const;

/** How many appointments each list day holds. */
export const LIST_SIZE = {
  kavya: KAVYA_LIST_TIMES.length,
  arjun: ARJUN_LIST_TIMES.length,
} as const;

interface Clinic {
  admin: ApiClient;
  patients: Map<PatientKey, SeededPatient>;
}

const createDoctor = async (admin: ApiClient, doctor: DoctorSeed, departmentId: string) => {
  const created = await admin.post<{
    id: string;
    name: string;
    department: { id: string; name: string };
  }>('/doctors', {
    name: doctor.name,
    email: doctor.email,
    password: doctor.password,
    departmentId,
    specialization: doctor.specialization,
    slotDurationMinutes: doctor.slotDurationMinutes,
    schedule: doctor.schedule,
  });
  return {
    id: created.id,
    name: created.name,
    departmentId: created.department.id,
    departmentName: created.department.name,
  } satisfies SeededDoctor;
};

/** Books `patient`, registering them with their first booking. */
const bookFor = async (
  clinic: Clinic,
  doctorId: string,
  date: string,
  slotStart: string,
  patient: PatientKey,
  purpose: string,
): Promise<ApiAppointment> => {
  const known = clinic.patients.get(patient);
  const appointment = await book(clinic.admin, {
    doctorId,
    date,
    slotStart,
    purpose,
    ...(known ? { patientId: known.id } : { newPatient: PATIENTS[patient] }),
  });
  if (!known) {
    const { id, patientCode, name, mobile } = appointment.patient;
    clinic.patients.set(patient, { id, code: patientCode, name, mobile });
  }
  return appointment;
};

/**
 * 25 appointments over two days, in every status, across both doctors and all eight patients:
 * enough for pagination, sorting and each filter of the appointment list.
 */
const seedListDays = async (clinic: Clinic, kavya: SeededDoctor, arjun: SeededDoctor) => {
  // Dr. Rao's day must be one he works (Monday to Saturday).
  const arjunDay = nextDateOn(addDays(suiteDate('list'), 1), MONDAY_TO_SATURDAY);
  const kavyaDay = addDays(arjunDay, -1);

  const kavyaBookings: ApiAppointment[] = [];
  for (const [index, time] of KAVYA_LIST_TIMES.entries()) {
    const patient = PATIENT_KEYS[index % PATIENT_KEYS.length] ?? 'asha';
    const purpose = PURPOSES[index % PURPOSES.length] ?? PURPOSES[0];
    kavyaBookings.push(await bookFor(clinic, kavya.id, kavyaDay, time, patient, purpose));
  }
  const arjunBookings: ApiAppointment[] = [];
  for (const [index, time] of ARJUN_LIST_TIMES.entries()) {
    const patient = PATIENT_KEYS[(index + 3) % PATIENT_KEYS.length] ?? 'asha';
    arjunBookings.push(await bookFor(clinic, arjun.id, arjunDay, time, patient, 'Skin review'));
  }

  const [first, second, third, fourth] = kavyaBookings;
  const [arjunFirst, arjunSecond] = arjunBookings;
  if (!first || !second || !third || !fourth || !arjunFirst || !arjunSecond) {
    throw new Error('The list days were not booked');
  }
  // Two of each status besides SCHEDULED.
  await arrive(clinic.admin, first.id);
  await complete(clinic.admin, first.id);
  await arrive(clinic.admin, second.id);
  await cancel(clinic.admin, third.id);
  await arrive(clinic.admin, fourth.id);
  await cancel(clinic.admin, arjunFirst.id);
  await arrive(clinic.admin, arjunSecond.id);
  await complete(clinic.admin, arjunSecond.id);

  return { kavya: kavyaDay, arjun: arjunDay };
};

/** Creates the clinic's staff, doctors, patients and appointments through the API. */
export const seedClinic = async (apiUrl: string): Promise<SeedInfo> => {
  const admin = await signInToApi(apiUrl, ADMIN);
  const departmentList = await admin.get<{ id: string; name: string }[]>('/departments');
  const departments = Object.fromEntries(departmentList.map(({ id, name }) => [name, id]));
  const departmentId = (name: string): string => {
    const id = departments[name];
    if (id === undefined) {
      throw new Error(`The seed script did not create the ${name} department`);
    }
    return id;
  };

  await admin.post('/users/receptionists', RECEPTIONIST);
  const kavya = await createDoctor(admin, KAVYA, departmentId(KAVYA.department));
  const arjun = await createDoctor(admin, ARJUN, departmentId(ARJUN.department));

  const clinic: Clinic = { admin, patients: new Map() };
  const listDays = await seedListDays(clinic, kavya, arjun);

  const patients = Object.fromEntries(
    PATIENT_KEYS.map((key) => {
      const patient = clinic.patients.get(key);
      if (!patient) {
        throw new Error(`Patient ${key} was not registered`);
      }
      return [key, patient];
    }),
  ) as Record<PatientKey, SeededPatient>;

  return { departments, doctors: { kavya, arjun }, patients, listDays };
};
