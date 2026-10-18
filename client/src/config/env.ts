import { z } from 'zod';

/** Where the app finds the API and its Socket.IO server, and which clock the clinic runs on. */
export interface ClientEnv {
  /** Base URL of the REST API, for example http://localhost:5000/api/v1. */
  apiUrl: string;
  /** Origin that Socket.IO connects to, for example http://localhost:5000. */
  socketUrl: string;
  /** IANA timezone of the clinic; must match the server's CLINIC_TIMEZONE. */
  clinicTimezone: string;
}

const DEFAULT_API_URL = 'http://localhost:5000/api/v1';
const DEFAULT_CLINIC_TIMEZONE = 'Asia/Kolkata';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const isValidTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

// An unset variable and an empty one (`VITE_SOCKET_URL=` in a .env file) both mean "use the default".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const httpUrl = z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' });

// A path such as /api/v1 works too, when a reverse proxy serves the API from the app's own origin.
const apiPath = z.string().regex(/^\/\S*$/);

const rawEnvSchema = z.object({
  VITE_API_URL: optional(
    z.union([httpUrl, apiPath], { error: 'must be an http(s) URL or a path starting with /' }),
  ),
  VITE_SOCKET_URL: optional(httpUrl),
  VITE_CLINIC_TIMEZONE: optional(
    z.string().refine(isValidTimezone, 'must be an IANA timezone such as Asia/Kolkata'),
  ),
});

/**
 * Validates the build-time VITE_ variables. An invalid value stops the app at startup with the
 * variable's name, never its value. `pageOrigin` turns an API path into the origin Socket.IO uses.
 */
export const parseClientEnv = (raw: unknown, pageOrigin: string): ClientEnv => {
  const parsed = rawEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`);
    throw new Error(`Invalid client configuration: ${problems.join('; ')}`);
  }
  const apiUrl = withoutTrailingSlash(parsed.data.VITE_API_URL ?? DEFAULT_API_URL);
  const socketUrl = withoutTrailingSlash(
    parsed.data.VITE_SOCKET_URL ?? new URL(apiUrl, pageOrigin).origin,
  );
  const clinicTimezone = parsed.data.VITE_CLINIC_TIMEZONE ?? DEFAULT_CLINIC_TIMEZONE;
  return { apiUrl, socketUrl, clinicTimezone };
};

export const env: Readonly<ClientEnv> = Object.freeze(
  parseClientEnv(import.meta.env, window.location.origin),
);
