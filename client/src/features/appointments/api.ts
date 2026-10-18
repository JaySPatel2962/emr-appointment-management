import type { AppointmentSortField, AppointmentStatus } from '@/constants/appointment';
import type { Gender } from '@/constants/patient';
import { deleteData, getAllPages, getData, getPage, postData, putData } from '@/services/api';
import type { Page, SortOrder } from '@/types/api';
import type { Appointment, AppointmentDetail, AppointmentSummary } from '@/types/models';

export interface AppointmentFilters {
  status?: AppointmentStatus | undefined;
  patientName?: string | undefined;
  mobile?: string | undefined;
  doctorName?: string | undefined;
  departmentId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
}

export type AppointmentListParams = AppointmentFilters & {
  page: number;
  limit: number;
  sortBy: AppointmentSortField;
  sortOrder: SortOrder;
};

export interface NewPatientBody {
  name: string;
  mobile: string;
  gender: Gender;
  dateOfBirth?: string;
}

export type CreateAppointmentBody = {
  doctorId: string;
  date: string;
  slotStart: string;
  purpose: string;
  notes?: string;
} & ({ patientId: string } | { newPatient: NewPatientBody });

export interface UpdateAppointmentBody {
  purpose?: string;
  notes?: string;
}

export const listAppointments = (
  params: AppointmentListParams,
  signal: AbortSignal,
): Promise<Page<Appointment>> =>
  getPage<Appointment>('/appointments', { params: { ...params }, signal });

/** Every appointment of one day, in time order: one doctor's, or the whole clinic's. */
export const listDayAppointments = (
  date: string,
  doctorId: string | null,
  signal: AbortSignal,
): Promise<AppointmentSummary[]> =>
  getAllPages<Appointment>('/appointments', {
    params: { dateFrom: date, dateTo: date, doctorId, sortBy: 'date', sortOrder: 'asc' },
    signal,
  });

export const getAppointment = (id: string, signal: AbortSignal): Promise<AppointmentDetail> =>
  getData<AppointmentDetail>(`/appointments/${id}`, { signal });

export const createAppointment = (body: CreateAppointmentBody): Promise<Appointment> =>
  postData<Appointment>('/appointments', body);

export const updateAppointment = ({
  id,
  ...body
}: UpdateAppointmentBody & { id: string }): Promise<Appointment> =>
  putData<Appointment>(`/appointments/${id}`, body);

export const markArrived = (id: string): Promise<Appointment> =>
  postData<Appointment>(`/appointments/${id}/arrive`);

export const completeAppointment = (id: string): Promise<Appointment> =>
  postData<Appointment>(`/appointments/${id}/complete`);

/** Cancels the appointment; it stays on record and its slot can be booked again at once. */
export const cancelAppointment = (id: string): Promise<Appointment> =>
  deleteData<Appointment>(`/appointments/${id}`);
