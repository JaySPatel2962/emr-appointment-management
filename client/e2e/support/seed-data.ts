// The clinic the end-to-end tests run against: its staff, doctors, schedules and patients.
// Global setup creates all of it through the API before the first test.

export interface Account {
  name: string;
  email: string;
  password: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface DaySchedule {
  /** 0 = Sunday ... 6 = Saturday. */
  dayOfWeek: number;
  sessions: TimeRange[];
  breaks: TimeRange[];
}

export interface DoctorSeed extends Account {
  department: string;
  specialization: string;
  slotDurationMinutes: number;
  schedule: DaySchedule[];
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface PatientSeed {
  name: string;
  /** The 10-digit form the API stores. */
  mobile: string;
  gender: Gender;
  dateOfBirth?: string;
}

export const DEPARTMENT_NAMES = [
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Pediatrics',
] as const;

/** Created by the server's seed script, from the SEED_ADMIN_* variables. */
export const ADMIN: Account = {
  name: 'Nisha Kapoor',
  email: 'admin@clinic.example',
  password: 'Admin@12345',
};

export const RECEPTIONIST: Account = {
  name: 'Priya Nair',
  email: 'priya.nair@clinic.example',
  password: 'Welcome123',
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;
export const MONDAY_TO_SATURDAY = [1, 2, 3, 4, 5, 6] as const;

const range = (start: string, end: string): TimeRange => ({ start, end });

const week = (days: readonly number[], sessions: TimeRange[], breaks: TimeRange[]): DaySchedule[] =>
  days.map((dayOfWeek) => ({ dayOfWeek, sessions, breaks }));

/**
 * Cardiology, 15-minute slots, every day. The morning session starts at midnight so that, at
 * whatever time the suite runs, today has slots that are already past and slots still free.
 * Lunch is a break inside the morning session; the evening session starts at 17:00.
 */
export const KAVYA: DoctorSeed = {
  name: 'Dr. Kavya Mehta',
  email: 'kavya.mehta@clinic.example',
  password: 'Welcome123',
  department: 'Cardiology',
  specialization: 'Interventional Cardiology',
  slotDurationMinutes: 15,
  schedule: week(
    EVERY_DAY,
    [range('00:00', '14:00'), range('17:00', '23:45')],
    [range('12:00', '13:00')],
  ),
};

/** Dermatology, 20-minute slots, Monday to Saturday: a morning with lunch, and an evening. */
export const ARJUN: DoctorSeed = {
  name: 'Dr. Arjun Rao',
  email: 'arjun.rao@clinic.example',
  password: 'Welcome123',
  department: 'Dermatology',
  specialization: 'Clinical Dermatology',
  slotDurationMinutes: 20,
  schedule: week(
    MONDAY_TO_SATURDAY,
    [range('10:00', '14:00'), range('17:00', '20:00')],
    [range('12:20', '13:00')],
  ),
};

/** Registered through their first booking, as the front desk would. */
export const PATIENTS = {
  asha: { name: 'Asha Rao', mobile: '9876543210', gender: 'FEMALE', dateOfBirth: '1990-05-14' },
  ravi: { name: 'Ravi Kumar', mobile: '9123456780', gender: 'MALE' },
  meera: { name: 'Meera Iyer', mobile: '9988776655', gender: 'FEMALE', dateOfBirth: '1984-11-02' },
  imran: { name: 'Imran Khan', mobile: '9012345678', gender: 'MALE', dateOfBirth: '1979-03-21' },
  lakshmi: {
    name: 'Lakshmi Menon',
    mobile: '9845012345',
    gender: 'FEMALE',
    dateOfBirth: '1962-08-30',
  },
  farhan: {
    name: 'Farhan Sheikh',
    mobile: '9700011122',
    gender: 'MALE',
    dateOfBirth: '2001-01-09',
  },
  gita: { name: 'Gita Sharma', mobile: '9811122233', gender: 'FEMALE', dateOfBirth: '1975-12-25' },
  tenzin: { name: 'Tenzin Dorje', mobile: '9622233344', gender: 'OTHER' },
} as const satisfies Record<string, PatientSeed>;

export type PatientKey = keyof typeof PATIENTS;

export const PATIENT_KEYS = Object.keys(PATIENTS) as PatientKey[];
