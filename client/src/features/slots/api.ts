import { getData } from '@/services/api';
import type { DaySlots } from '@/types/models';

/** One doctor's slots on one date, each AVAILABLE, BOOKED (with its appointment) or PAST. */
export const getDaySlots = (
  doctorId: string,
  date: string,
  signal: AbortSignal,
): Promise<DaySlots> => getData<DaySlots>('/slots', { params: { doctorId, date }, signal });
