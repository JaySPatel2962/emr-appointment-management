import { z } from 'zod';

import { dateSchema, objectIdSchema } from '#app/validators/common.js';

const slotsQuery = z.object({
  doctorId: objectIdSchema,
  date: dateSchema,
  departmentId: objectIdSchema.optional(),
});

export const slotsSchema = z.object({ query: slotsQuery });

export type SlotsQuery = z.output<typeof slotsQuery>;
