import { SLOT_STATUS } from '@/constants/slot';
import type { SlotStatus } from '@/constants/slot';
import type { Slot } from '@/types/models';
import type { ClinicMoment } from '@/utils/date';
import { timeToMinutes } from '@/utils/time';

/** The server's rule: a slot is past once the clinic's clock reaches its start. */
export const isPastSlot = (date: string, slot: Pick<Slot, 'start'>, now: ClinicMoment): boolean =>
  date < now.date || (date === now.date && timeToMinutes(slot.start) <= now.minutes);

/**
 * A slot's status at `now`. The grid stays open for hours, so a slot the API sent as AVAILABLE
 * turns PAST on screen when its time comes, without a refetch. A BOOKED slot stays BOOKED, as on
 * the server, so a late arrival can still be marked.
 */
export const slotStatusAt = (slot: Slot, date: string, now: ClinicMoment): SlotStatus =>
  slot.status === SLOT_STATUS.AVAILABLE && isPastSlot(date, slot, now)
    ? SLOT_STATUS.PAST
    : slot.status;
