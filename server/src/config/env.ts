import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

// Tests configure themselves in vitest.config.ts and must never read a developer's .env.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });
}

const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGO_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Trailing slashes are dropped so the value matches the browser's Origin header exactly.
  CLIENT_URL: z
    .url()
    .default('http://localhost:5173')
    .transform((url) => url.replace(/\/+$/, '')),
  CLINIC_TIMEZONE: z
    .string()
    .refine(isValidTimezone, 'must be a valid IANA timezone')
    .default('Asia/Kolkata'),

  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  BODY_LIMIT: z.string().default('100kb'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Name the invalid variables, never their values.
  const problems = parsed.error.issues.map(
    (issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`,
  );
  throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
}

export type Env = z.infer<typeof envSchema>;

export const env: Readonly<Env> = Object.freeze(parsed.data);
