import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

import { describeConfigIssues } from '#app/utils/config-issues.js';

// Tests configure themselves in vitest.config.ts and must never read a developer's .env.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });
}

const MIN_SECRET_LENGTH = 32;
const MIN_PRODUCTION_BCRYPT_ROUNDS = 10;

const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const secretSchema = z
  .string()
  .min(MIN_SECRET_LENGTH, `must be at least ${MIN_SECRET_LENGTH} characters (run npm run secrets)`);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

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

    JWT_ACCESS_SECRET: secretSchema,
    JWT_REFRESH_SECRET: secretSchema,
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    REFRESH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    BODY_LIMIT: z.string().default('100kb'),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  })
  .superRefine((config, ctx) => {
    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET',
      });
    }
    if (config.NODE_ENV === 'production' && config.BCRYPT_ROUNDS < MIN_PRODUCTION_BCRYPT_ROUNDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['BCRYPT_ROUNDS'],
        message: `must be at least ${MIN_PRODUCTION_BCRYPT_ROUNDS} in production`,
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${describeConfigIssues(parsed.error)}`);
}

export type Env = z.infer<typeof envSchema>;

export const env: Readonly<Env> = Object.freeze(parsed.data);
