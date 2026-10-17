import { z } from 'zod';

import { DAY_OF_WEEK, SLOT_DURATION_MINUTES } from '#app/constants/doctor.js';
import { findScheduleProblems } from '#app/utils/schedule.js';
import {
  idParamsSchema,
  objectIdSchema,
  paginationQuery,
  timeSchema,
} from '#app/validators/common.js';
import { staffAccountBody } from '#app/validators/user.validators.js';

// Generous upper bounds that keep request bodies small.
const MAX_RANGES_PER_DAY = 8;
const DAYS_IN_WEEK = 7;

const timeRangeSchema = z.object({ start: timeSchema, end: timeSchema });

/** A weekly schedule, checked by the same rules the Doctor model enforces. */
export const scheduleSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(DAY_OF_WEEK.SUNDAY).max(DAY_OF_WEEK.SATURDAY),
      sessions: z.array(timeRangeSchema).max(MAX_RANGES_PER_DAY),
      breaks: z.array(timeRangeSchema).max(MAX_RANGES_PER_DAY).default([]),
    }),
  )
  .max(DAYS_IN_WEEK)
  .superRefine((schedule, ctx) => {
    for (const problem of findScheduleProblems(schedule)) {
      ctx.addIssue({ code: 'custom', path: problem.path, message: problem.message });
    }
  });

const slotDurationSchema = z
  .number()
  .int()
  .min(SLOT_DURATION_MINUTES.MIN)
  .max(SLOT_DURATION_MINUTES.MAX);

const createDoctorBody = staffAccountBody.extend({
  departmentId: objectIdSchema,
  specialization: z.string().trim().min(1, 'Required').max(100),
  slotDurationMinutes: slotDurationSchema,
  schedule: scheduleSchema.default([]),
});

const updateScheduleBody = z.object({
  schedule: scheduleSchema,
  slotDurationMinutes: slotDurationSchema.optional(),
});

const listDoctorsQuery = z.object({
  departmentId: objectIdSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  ...paginationQuery,
});

export const createDoctorSchema = z.object({ body: createDoctorBody });
export const updateScheduleSchema = z.object({ params: idParamsSchema, body: updateScheduleBody });
export const listDoctorsSchema = z.object({ query: listDoctorsQuery });
export const doctorIdSchema = z.object({ params: idParamsSchema });

export type CreateDoctorInput = z.output<typeof createDoctorBody>;
export type UpdateScheduleInput = z.output<typeof updateScheduleBody>;
export type ListDoctorsQuery = z.output<typeof listDoctorsQuery>;
