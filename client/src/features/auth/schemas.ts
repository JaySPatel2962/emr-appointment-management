import { z } from 'zod';

// The API's own login rules: an email of at most 254 characters, and a password of 1 to 72
// (bcrypt's limit). There's no strength rule at login, so a hint can't help anyone guess.
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 72;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address')
    .pipe(
      z
        .email('Enter a valid email address, like name@clinic.example')
        .max(MAX_EMAIL_LENGTH, 'Email addresses are at most 254 characters'),
    ),
  password: z
    .string()
    .min(1, 'Enter your password')
    .max(MAX_PASSWORD_LENGTH, 'Passwords are at most 72 characters'),
});

export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginCredentials = z.output<typeof loginSchema>;
