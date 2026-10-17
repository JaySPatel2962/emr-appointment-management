import type { AuthUser } from '#app/types/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** The authenticated caller; set by the `authenticate` middleware. */
    user?: AuthUser;
    /** Parsed request input; set by `validate(schema)` and read with `getValidated(req, schema)`. */
    validated?: { schema: unknown; data: unknown };
  }
}
