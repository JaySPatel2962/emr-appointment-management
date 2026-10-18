import type { QueryClient } from '@tanstack/react-query';

import { appointmentKeys } from '@/features/appointments/query-keys';
import { slotKeys } from '@/features/slots/queries';
import { applyToSlots } from '@/features/slots/utils/live-slots';
import type { AppointmentChange } from '@/features/slots/utils/live-slots';
import type { AppointmentDetail, AppointmentSummary, DaySlots } from '@/types/models';
import { clinicMoment } from '@/utils/date';
import { timeToMinutes } from '@/utils/time';

const byTime = (a: AppointmentSummary, b: AppointmentSummary): number =>
  timeToMinutes(a.slotStart) - timeToMinutes(b.slotStart);

/** The day's list with this appointment added or brought up to date, keeping any notes it had. */
const upsert = (
  list: AppointmentSummary[] | undefined,
  appointment: AppointmentSummary,
): AppointmentSummary[] | undefined => {
  if (!list) {
    return list;
  }
  const index = list.findIndex((item) => item.id === appointment.id);
  if (index === -1) {
    return [...list, appointment].sort(byTime);
  }
  return list.map((item, position) => (position === index ? { ...item, ...appointment } : item));
};

/**
 * Brings every cached view of an appointment up to date after a change, whether this tab made
 * it (a mutation's response) or another user did (a Socket.IO event, which has no notes):
 * - the doctor's slot grid for that day, slot by slot, without a refetch
 * - the day lists behind the scheduler and the dashboard
 * - its detail, keeping the full patient record and the notes
 * Paged lists can't be patched safely, since a change can move a row to another page or out of
 * the filter, so they are refetched in the background.
 */
export const syncAppointment = (
  queryClient: QueryClient,
  appointment: AppointmentSummary,
  change: AppointmentChange,
): void => {
  const doctorId = appointment.doctor.id;

  queryClient.setQueryData<DaySlots>(slotKeys.day(doctorId, appointment.date), (day) =>
    day ? applyToSlots(day, appointment, change, clinicMoment()) : day,
  );
  for (const key of [
    appointmentKeys.day(doctorId, appointment.date),
    appointmentKeys.day(null, appointment.date),
  ]) {
    queryClient.setQueryData<AppointmentSummary[]>(key, (list) => upsert(list, appointment));
  }
  queryClient.setQueryData<AppointmentDetail>(appointmentKeys.detail(appointment.id), (detail) =>
    detail ? { ...detail, ...appointment, patient: detail.patient } : detail,
  );
  void queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
};
