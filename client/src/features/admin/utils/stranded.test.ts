import { describe, expect, it } from 'vitest';

import { appointmentListLink, strandedAppointmentsIn } from '@/features/admin/utils/stranded';
import { ApiError } from '@/services/api-error';

const appointment = {
  id: '6ad52b9e5099159b77ebd84e',
  date: '2026-10-23',
  slotStart: '10:30',
  slotEnd: '11:00',
  status: 'SCHEDULED',
  patient: { id: '6ad52b9e5099159b77ebd84f', patientCode: 'PAT-000025', name: 'Pooja Nair' },
};

describe('strandedAppointmentsIn', () => {
  it('reads the appointments that blocked a schedule change from the 409', () => {
    const error = new ApiError('This schedule would leave 1 booked appointment without its slot', {
      status: 409,
      meta: { requestId: 'r-1', appointments: [appointment] },
    });

    expect(strandedAppointmentsIn(error)).toEqual([appointment]);
  });

  it('finds none in any other error, or in a list it cannot read', () => {
    expect(strandedAppointmentsIn(new ApiError('Slot already booked', { status: 409 }))).toEqual(
      [],
    );
    expect(
      strandedAppointmentsIn(
        new ApiError('Validation failed', { status: 400, meta: { appointments: [appointment] } }),
      ),
    ).toEqual([]);
    expect(
      strandedAppointmentsIn(
        new ApiError('Conflict', { status: 409, meta: { appointments: [{ id: 1 }] } }),
      ),
    ).toEqual([]);
    expect(strandedAppointmentsIn(new Error('boom'))).toEqual([]);
  });
});

describe('appointmentListLink', () => {
  it("opens the list on the doctor's day", () => {
    expect(appointmentListLink('Dr. Farhan Qureshi', '2026-10-23')).toBe(
      '/appointments?doctorName=Dr.+Farhan+Qureshi&dateFrom=2026-10-23&dateTo=2026-10-23',
    );
  });
});
