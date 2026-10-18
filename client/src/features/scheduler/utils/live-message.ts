import { APPOINTMENT_STATUS } from '@/constants/appointment';
import type { AppointmentChange } from '@/features/slots/utils/live-slots';
import type { AppointmentSummary } from '@/types/models';

/** What a live change means, in a sentence: announced to screen readers as it happens. */
export const describeChange = (
  change: AppointmentChange,
  appointment: AppointmentSummary,
): string => {
  const { slotStart } = appointment;
  const name = appointment.patient.name;
  if (change === 'created') {
    return `${slotStart} was just booked for ${name}.`;
  }
  if (change === 'cancelled') {
    return `${name}'s ${slotStart} appointment was cancelled. The slot is free again.`;
  }
  if (appointment.status === APPOINTMENT_STATUS.ARRIVED) {
    return `${name} has arrived for ${slotStart}.`;
  }
  if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
    return `${name}'s ${slotStart} visit is complete.`;
  }
  return `${name}'s ${slotStart} appointment was updated.`;
};
