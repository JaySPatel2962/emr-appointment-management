import { z } from 'zod';

import { emailSchema, MAX_PASSWORD_LENGTH } from '#app/validators/common.js';

// No password policy at login: it applies when passwords are set, and a hint here would help guessing.
export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Required').max(MAX_PASSWORD_LENGTH),
  }),
});
