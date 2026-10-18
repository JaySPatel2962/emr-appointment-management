import { z } from 'zod';

import { GENDERS, NAME_MAX_LENGTH } from '@/constants/patient';
import { notesSchema, purposeSchema } from '@/features/appointments/schemas';
import { isValidMobile, normalizeMobile } from '@/features/patients/utils/mobile';
import { clinicMoment, isValidDate } from '@/utils/date';

export const PATIENT_MODES = ['existing', 'new'] as const;

export type PatientMode = (typeof PATIENT_MODES)[number];

const EARLIEST_BIRTH_DATE = '1900-01-01';

/** A new patient, with the API's rules: the mobile number comes out in its 10-digit form. */
export const newPatientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the patient's name")
    .max(NAME_MAX_LENGTH, `Names are at most ${String(NAME_MAX_LENGTH)} characters`),
  mobile: z
    .string()
    .trim()
    .min(1, 'Enter a mobile number')
    .refine(isValidMobile, 'Enter a 10-digit Indian mobile number, such as 98765 43210')
    .transform(normalizeMobile),
  gender: z.enum(GENDERS, { error: 'Choose a gender' }),
  dateOfBirth: z
    .string()
    .refine((value) => value === '' || isValidDate(value), 'Enter a real date')
    .refine((value) => value === '' || value >= EARLIEST_BIRTH_DATE, 'Enter a date after 1900')
    .refine(
      (value) => value === '' || value <= clinicMoment().date,
      "The date of birth can't be in the future",
    ),
});

/**
 * The booking form: a patient (found, or new) and the visit. Every field always exists, so the
 * form keeps what was typed when switching between "existing" and "new"; only the chosen kind
 * of patient is validated. The doctor, date and time come from the URL, not from this form.
 */
export const bookingSchema = z
  .object({
    patientMode: z.enum(PATIENT_MODES),
    patientId: z.string(),
    newPatient: z.object({
      name: z.string(),
      mobile: z.string(),
      gender: z.string(),
      dateOfBirth: z.string(),
    }),
    purpose: purposeSchema,
    notes: notesSchema,
  })
  .superRefine((values, ctx) => {
    if (values.patientMode === 'existing') {
      if (values.patientId === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['patientId'],
          message: 'Choose a patient, or register a new one',
        });
      }
      return;
    }
    const patient = newPatientSchema.safeParse(values.newPatient);
    if (!patient.success) {
      for (const issue of patient.error.issues) {
        ctx.addIssue({
          code: 'custom',
          path: ['newPatient', ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export type BookingFormValues = z.input<typeof bookingSchema>;
export type BookingFormOutput = z.output<typeof bookingSchema>;

export const EMPTY_BOOKING: BookingFormValues = {
  patientMode: 'existing',
  patientId: '',
  newPatient: { name: '', mobile: '', gender: '', dateOfBirth: '' },
  purpose: '',
  notes: '',
};
