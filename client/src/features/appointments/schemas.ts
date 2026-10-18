import { z } from 'zod';

import { NOTES_MAX_LENGTH, PURPOSE_MAX_LENGTH } from '@/constants/appointment';

export const purposeSchema = z
  .string()
  .trim()
  .min(1, 'Enter the purpose of the visit')
  .max(PURPOSE_MAX_LENGTH, `Keep the purpose under ${String(PURPOSE_MAX_LENGTH)} characters`);

export const notesSchema = z
  .string()
  .trim()
  .max(NOTES_MAX_LENGTH, `Keep the notes under ${String(NOTES_MAX_LENGTH)} characters`);

export const editAppointmentSchema = z.object({
  purpose: purposeSchema,
  notes: notesSchema,
});

export type EditAppointmentValues = z.input<typeof editAppointmentSchema>;
export type EditAppointmentInput = z.output<typeof editAppointmentSchema>;
