import { z } from 'zod';

import { SLOT_DURATION_MINUTES, SPECIALIZATION_MAX_LENGTH } from '@/constants/doctor';
import { NAME_MAX_LENGTH } from '@/constants/patient';
import { editorIndexOf, toSchedule } from '@/features/admin/utils/schedule-form';
import type { ScheduleDayValues } from '@/features/admin/utils/schedule-form';
import { findScheduleProblems } from '@/features/admin/utils/schedule-rules';

// The API's rules for staff accounts: a password of 8 to 72 characters (bcrypt's limit) with
// a letter and a number, and an email that no other account uses (checked by the server).

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the full name')
    .max(NAME_MAX_LENGTH, `Names are at most ${String(NAME_MAX_LENGTH)} characters`),
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address')
    .pipe(
      z.email('Enter a valid email address').max(254, 'Email addresses are at most 254 characters'),
    ),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${String(MIN_PASSWORD_LENGTH)} characters`)
    .max(MAX_PASSWORD_LENGTH, `Use at most ${String(MAX_PASSWORD_LENGTH)} characters`)
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
});

export type AccountFormValues = z.input<typeof accountSchema>;
export type AccountFormOutput = z.output<typeof accountSchema>;

export const doctorDetailsSchema = z.object({
  departmentId: z.string().min(1, 'Choose a department'),
  specialization: z
    .string()
    .trim()
    .min(1, 'Enter the specialization')
    .max(
      SPECIALIZATION_MAX_LENGTH,
      `Keep it under ${String(SPECIALIZATION_MAX_LENGTH)} characters`,
    ),
});

export type DoctorDetailsValues = z.input<typeof doctorDetailsSchema>;
export type DoctorDetailsOutput = z.output<typeof doctorDetailsSchema>;

const rangeSchema = z.object({ start: z.string(), end: z.string() });

/**
 * A slot length and the week's working days. The API's schedule rules run on the working days,
 * and each problem is reported on the row (and range) it is about.
 */
export const scheduleFormSchema = z
  .object({
    slotDurationMinutes: z
      .string()
      .refine((value) => {
        const minutes = Number(value);
        return (
          Number.isInteger(minutes) &&
          minutes >= SLOT_DURATION_MINUTES.MIN &&
          minutes <= SLOT_DURATION_MINUTES.MAX
        );
      }, 'Choose a slot length')
      .transform(Number),
    days: z.array(
      z.object({
        dayOfWeek: z.number(),
        works: z.boolean(),
        sessions: z.array(rangeSchema),
        breaks: z.array(rangeSchema),
      }),
    ),
  })
  .superRefine(({ days }, ctx) => {
    for (const problem of findScheduleProblems(toSchedule(days))) {
      const [scheduleIndex, ...rest] = problem.path;
      ctx.addIssue({
        code: 'custom',
        path: ['days', editorIndexOf(days, Number(scheduleIndex)), ...rest],
        message: problem.message,
      });
    }
  });

export type ScheduleFormValues = z.input<typeof scheduleFormSchema>;
export type ScheduleFormOutput = z.output<typeof scheduleFormSchema>;

export const scheduleFormDefaults = (
  slotDurationMinutes: number,
  days: ScheduleDayValues[],
): ScheduleFormValues => ({ slotDurationMinutes: String(slotDurationMinutes), days });
