import { describe, expect, it } from 'vitest';

import { bookingFailure } from '@/features/booking/utils/booking-failure';
import { ApiError } from '@/services/api-error';

const SCHEDULE_CHANGED =
  "The doctor's schedule changed while this was being booked. Check the free times and try again.";
const CONCURRENT =
  'This could not be saved because of a change made at the same moment. Try again.';

describe('bookingFailure', () => {
  it('says someone else got the slot when the slot is taken', () => {
    expect(bookingFailure(new ApiError('Slot already booked', { status: 409 }), '10:30')).toEqual({
      kind: 'slot',
      message: 'Someone else booked 10:30 a moment ago. Choose another time.',
    });
  });

  // Found in the manual retest: a booking racing a schedule change was undone, and the form
  // would have blamed another booking.
  it("gives the API's reason when the schedule changed while booking", () => {
    const error = new ApiError(SCHEDULE_CHANGED, {
      status: 409,
      meta: { code: 'SCHEDULE_CHANGED' },
    });

    expect(bookingFailure(error, '10:30')).toEqual({ kind: 'slot', message: SCHEDULE_CHANGED });
  });

  it('keeps the chosen time when a change at the same moment only asks to try again', () => {
    const error = new ApiError(CONCURRENT, { status: 409, meta: { code: 'CONCURRENT_UPDATE' } });

    expect(bookingFailure(error, '10:30')).toEqual({ kind: 'other' });
  });

  it('asks for another time when the slot has started', () => {
    expect(
      bookingFailure(new ApiError('This slot is in the past', { status: 422 }), '10:30'),
    ).toEqual({ kind: 'slot', message: 'This slot is in the past. Choose another time.' });
  });

  it('leaves field errors and anything else to the form', () => {
    expect(bookingFailure(new ApiError('Validation failed', { status: 400 }), '10:30')).toEqual({
      kind: 'other',
    });
    expect(bookingFailure(new Error('boom'), '10:30')).toEqual({ kind: 'other' });
  });
});
