import type { AppointmentStatus } from '@/constants/appointment';
import type { Gender } from '@/constants/patient';
import type { Role } from '@/constants/roles';
import type { SlotStatus } from '@/constants/slot';

// The API's resources, as docs/API.md describes them. Dates are "YYYY-MM-DD" and times "HH:mm"
// on the clinic's clock; timestamps (createdAt and so on) are ISO 8601 in UTC.

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Only for DOCTOR users: the id of their doctor profile. */
  doctorId?: string;
}

/** What login and refresh return. The refresh token itself only ever travels in its cookie. */
export interface Session {
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds until the access token expires (900). */
  expiresIn: number;
  user: User;
}

export interface Department {
  id: string;
  name: string;
}

/** A half-open range [start, end) of "HH:mm" times. */
export interface TimeRange {
  start: string;
  end: string;
}

export interface DaySchedule {
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number;
  sessions: TimeRange[];
  breaks: TimeRange[];
}

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  department: Department;
  slotDurationMinutes: number;
  schedule: DaySchedule[];
  /** Goes up with every saved schedule change; a save sends back the version it started from. */
  scheduleVersion: number;
}

export interface Slot {
  start: string;
  end: string;
  status: SlotStatus;
  /** Only on BOOKED slots: the appointment holding it. */
  appointmentId?: string;
}

export interface DaySlots {
  doctorId: string;
  date: string;
  timezone: string;
  slotDurationMinutes: number;
  slots: Slot[];
}

export interface Patient {
  id: string;
  patientCode: string;
  name: string;
  mobile: string;
  gender: Gender;
  dateOfBirth: string | null;
}

export type PatientSummary = Pick<Patient, 'id' | 'patientCode' | 'name' | 'mobile'>;

/** An appointment without its clinical notes: what Socket.IO events carry. */
export interface AppointmentSummary {
  id: string;
  patient: PatientSummary;
  doctor: { id: string; name: string };
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  purpose: string;
  status: AppointmentStatus;
  /** Id of the user who booked it. */
  createdBy: string;
  arrivedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An appointment as lists and updates return it. */
export interface Appointment extends AppointmentSummary {
  notes: string;
}

/** GET /appointments/:id: the same, with the full patient record. */
export interface AppointmentDetail extends Omit<Appointment, 'patient'> {
  patient: Patient;
}
