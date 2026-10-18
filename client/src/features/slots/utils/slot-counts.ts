import { SLOT_STATUS } from '@/constants/slot';
import type { SlotStatus } from '@/constants/slot';
import { slotStatusAt } from '@/features/slots/utils/slot-state';
import type { Slot } from '@/types/models';
import type { ClinicMoment } from '@/utils/date';

/** How many of the day's slots are available, booked and past right now. */
export const countSlots = (
  slots: readonly Slot[],
  date: string,
  now: ClinicMoment,
): Record<SlotStatus, number> => {
  const counts: Record<SlotStatus, number> = {
    [SLOT_STATUS.AVAILABLE]: 0,
    [SLOT_STATUS.BOOKED]: 0,
    [SLOT_STATUS.PAST]: 0,
  };
  for (const slot of slots) {
    counts[slotStatusAt(slot, date, now)] += 1;
  }
  return counts;
};
