import { z } from 'zod';

/** Where the app finds the API and its Socket.IO server. */
export interface ClientEnv {
  /** Base URL of the REST API, for example http://localhost:5000/api/v1. */
  apiUrl: string;
  /** Origin that Socket.IO connects to, for example http://localhost:5000. */
  socketUrl: string;
}

const DEFAULT_API_URL = 'http://localhost:5000/api/v1';

const withoutTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

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
  return { apiUrl, socketUrl };
};

export const env: Readonly<ClientEnv> = Object.freeze(
  parseClientEnv(import.meta.env, window.location.origin),
);
