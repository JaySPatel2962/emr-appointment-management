import type { AppointmentListParams } from '@/features/appointments/api';

export const appointmentKeys = {
  all: ['appointments'] as const,
  /** Paged, filtered lists: one cache entry per combination of filters, sort and page. */
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (params: AppointmentListParams) => [...appointmentKeys.lists(), params] as const,
  /** Whole days: one doctor's (the scheduler) or everyone's (the dashboard, `doctorId` null). */
  days: () => [...appointmentKeys.all, 'day'] as const,
  day: (doctorId: string | null, date: string) =>
    [...appointmentKeys.days(), doctorId ?? 'everyone', date] as const,
  detail: (id: string) => [...appointmentKeys.all, 'detail', id] as const,
};
