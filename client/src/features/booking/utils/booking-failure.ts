import { CONFLICT_CODES } from '@/constants/conflicts';
import { HTTP_STATUS } from '@/constants/http';
import { ApiError } from '@/services/api-error';

/**
 * What a failed booking means for the form. `slot`: the chosen time is gone (someone booked it,
 * it has started, or the doctor's schedule changed meanwhile), so the times are reloaded and
 * another is asked for. `other`: anything else, including a change that collided with this one
 * at the same moment, where the same booking can simply be sent again.
 */
export type BookingFailure = { kind: 'slot'; message: string } | { kind: 'other' };

export const bookingFailure = (error: unknown, slotStart: string): BookingFailure => {
  if (!(error instanceof ApiError)) {
    return { kind: 'other' };
  }
  if (error.status === HTTP_STATUS.CONFLICT) {
    if (error.meta.code === CONFLICT_CODES.SCHEDULE_CHANGED) {
      return { kind: 'slot', message: error.message };
    }
    if (error.meta.code === undefined) {
      return {
        kind: 'slot',
        message: `Someone else booked ${slotStart} a moment ago. Choose another time.`,
      };
    }
    return { kind: 'other' };
  }
  if (error.status === HTTP_STATUS.UNPROCESSABLE) {
    return { kind: 'slot', message: `${error.message}. Choose another time.` };
  }
  return { kind: 'other' };
};
