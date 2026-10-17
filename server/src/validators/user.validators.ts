import { z } from 'zod';

import { emailSchema, nameSchema, passwordSchema } from '#app/validators/common.js';

export const staffAccountBody = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const createReceptionistSchema = z.object({ body: staffAccountBody });

export type StaffAccountInput = z.output<typeof staffAccountBody>;
