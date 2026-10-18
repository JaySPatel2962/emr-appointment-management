import { describe, expect, it } from 'vitest';

import { bookingSchema, EMPTY_BOOKING } from '@/features/booking/schemas';
import { bookingFieldPath, toCreateAppointmentBody } from '@/features/booking/utils/booking-body';

const SLOT = { doctorId: '6ad4b1a4c42b65083c36c4e6', date: '2026-10-19', slotStart: '09:15' };

const issuesOf = (values: unknown) => {
  const result = bookingSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('the booking form', () => {
  it('needs a chosen patient in "existing" mode, and ignores the new-patient fields', () => {
    expect(issuesOf({ ...EMPTY_BOOKING, purpose: 'Follow-up' })).toEqual(['patientId']);
  });

  it('checks every new-patient field in "new" mode', () => {
    expect(
      issuesOf({
        ...EMPTY_BOOKING,
        patientMode: 'new',
        purpose: 'Follow-up',
        newPatient: { name: '', mobile: '12345', gender: '', dateOfBirth: '2999-01-01' },
      }),
    ).toEqual([
      'newPatient.name',
      'newPatient.mobile',
      'newPatient.gender',
      'newPatient.dateOfBirth',
    ]);
  });

  it('reports the visit and the patient together', () => {
    expect(issuesOf({ ...EMPTY_BOOKING, patientMode: 'new' })).toContain('purpose');
    expect(issuesOf({ ...EMPTY_BOOKING, patientMode: 'new' })).toContain('newPatient.name');
  });

  it('builds the request for an existing patient', () => {
    const values = bookingSchema.parse({
      ...EMPTY_BOOKING,
      patientId: '6ad4b1a6c42b65083c36c4f1',
      purpose: '  Follow-up ',
    });

    expect(toCreateAppointmentBody(values, SLOT)).toEqual({
      ...SLOT,
      purpose: 'Follow-up',
      patientId: '6ad4b1a6c42b65083c36c4f1',
    });
  });

  it('builds the request for a new patient, with the mobile number normalized', () => {
    const values = bookingSchema.parse({
      ...EMPTY_BOOKING,
      patientMode: 'new',
      purpose: 'First visit',
      notes: 'Bring old reports',
      newPatient: {
        name: ' Asha Rao ',
        mobile: '+91 98765 43210',
        gender: 'FEMALE',
        dateOfBirth: '',
      },
    });

    expect(toCreateAppointmentBody(values, SLOT)).toEqual({
      ...SLOT,
      purpose: 'First visit',
      notes: 'Bring old reports',
      newPatient: { name: 'Asha Rao', mobile: '9876543210', gender: 'FEMALE' },
    });
  });

  it("maps the server's field errors onto the form's fields", () => {
    expect(bookingFieldPath('body.newPatient.mobile')).toBe('newPatient.mobile');
    expect(bookingFieldPath('body.purpose')).toBe('purpose');
    expect(bookingFieldPath('body.slotStart')).toBeNull();
  });
});
