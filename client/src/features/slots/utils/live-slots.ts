import { SLOT_STATUS } from '@/constants/slot';
import { isPastSlot } from '@/features/slots/utils/slot-state';
import type { AppointmentSummary, DaySlots, Slot } from '@/types/models';
import type { ClinicMoment } from '@/utils/date';

export type AppointmentChange = 'created' | 'updated' | 'cancelled';

const slotAfter = (
  slot: Slot,
  date: string,
  appointment: Pick<AppointmentSummary, 'id' | 'slotStart'>,
  change: AppointmentChange,
  now: ClinicMoment,
): Slot => {
  if (change === 'created' && slot.start === appointment.slotStart) {
    return slot.status === SLOT_STATUS.BOOKED && slot.appointmentId === appointment.id
      ? slot
      : {
          start: slot.start,
          end: slot.end,
          status: SLOT_STATUS.BOOKED,
          appointmentId: appointment.id,
        };
  }
  if (change === 'cancelled' && slot.appointmentId === appointment.id) {
    return {
      start: slot.start,
      end: slot.end,
      status: isPastSlot(date, slot, now) ? SLOT_STATUS.PAST : SLOT_STATUS.AVAILABLE,
    };
  }
  return slot;
};

/**
 * A day's slot grid after an appointment change, worked out from the change itself instead of
 * a refetch. Unchanged slots keep their identity, so only the changed tile re-renders, and the
 * same grid comes back when nothing changed. Updates (arrival, notes) don't move slots.
 */
export const applyToSlots = (
  day: DaySlots,
  appointment: Pick<AppointmentSummary, 'id' | 'slotStart'>,
  change: AppointmentChange,
  now: ClinicMoment,
): DaySlots => {
  const slots = day.slots.map((slot) => slotAfter(slot, day.date, appointment, change, now));
  return slots.some((slot, index) => slot !== day.slots[index]) ? { ...day, slots } : day;
};
