import type { CreateAppointmentBody } from '@/features/appointments/api';
import { newPatientSchema } from '@/features/booking/schemas';
import type { BookingFormOutput } from '@/features/booking/schemas';

export interface BookingSlot {
  doctorId: string;
  date: string;
  slotStart: string;
}

/** The POST /appointments body for a validated form and a chosen slot. */
export const toCreateAppointmentBody = (
  values: BookingFormOutput,
  slot: BookingSlot,
): CreateAppointmentBody => {
  const visit = {
    ...slot,
    purpose: values.purpose,
    ...(values.notes === '' ? {} : { notes: values.notes }),
  };
  if (values.patientMode === 'existing') {
    return { ...visit, patientId: values.patientId };
  }
  // Already validated by the form; parsing again gives the typed, normalized values.
  const patient = newPatientSchema.parse(values.newPatient);
  return {
    ...visit,
    newPatient: {
      name: patient.name,
      mobile: patient.mobile,
      gender: patient.gender,
      ...(patient.dateOfBirth === '' ? {} : { dateOfBirth: patient.dateOfBirth }),
    },
  };
};

/** Which form field a server error belongs to; the slot's own fields have none in this form. */
export const bookingFieldPath = (field: string): string | null => {
  const path = field.startsWith('body.') ? field.slice('body.'.length) : field;
  return path.startsWith('newPatient.') || ['purpose', 'notes', 'patientId'].includes(path)
    ? path
    : null;
};
