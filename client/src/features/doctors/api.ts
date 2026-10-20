import { MAX_PAGE_SIZE } from '@/constants/http';
import { getData, getPage, postData, putData } from '@/services/api';
import type { DaySchedule, Doctor } from '@/types/models';

export interface DoctorFilters {
  departmentId?: string;
  search?: string;
}

export interface CreateDoctorBody {
  name: string;
  email: string;
  password: string;
  departmentId: string;
  specialization: string;
  slotDurationMinutes: number;
  schedule: DaySchedule[];
}

export interface UpdateScheduleBody {
  schedule: DaySchedule[];
  slotDurationMinutes?: number;
  /** The version the change is based on; an outdated one is refused with 409. */
  scheduleVersion: number;
}

/** Doctors sorted by name, up to 100: every doctor of a clinic fits in one page. A doctor sees only themselves. */
export const listDoctors = async (
  filters: DoctorFilters,
  signal: AbortSignal,
): Promise<Doctor[]> => {
  const page = await getPage<Doctor>('/doctors', {
    params: { ...filters, limit: MAX_PAGE_SIZE },
    signal,
  });
  return page.items;
};

export const getDoctor = (id: string, signal: AbortSignal): Promise<Doctor> =>
  getData<Doctor>(`/doctors/${id}`, { signal });

/** Creates the doctor's login and profile together. */
export const createDoctor = (body: CreateDoctorBody): Promise<Doctor> =>
  postData<Doctor>('/doctors', body);

/** Replaces the whole weekly schedule; booked appointments are kept. */
export const updateSchedule = (id: string, body: UpdateScheduleBody): Promise<Doctor> =>
  putData<Doctor>(`/doctors/${id}/schedule`, body);
