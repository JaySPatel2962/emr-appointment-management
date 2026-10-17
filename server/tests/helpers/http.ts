import type { Response } from 'supertest';
import type { z } from 'zod';

import type { ApiResponse } from '#app/utils/api-response.js';

/** supertest types the response body as `any`; this reads it as the API envelope. */
export const bodyOf = (response: Response): ApiResponse => response.body as ApiResponse;

/** Parses the response's `data` with a schema: checks the shape the API promises, and types it. */
export const dataOf = <S extends z.ZodType>(response: Response, schema: S): z.output<S> =>
  schema.parse(bodyOf(response).data);

/** The full Set-Cookie line for one cookie, or undefined when the response didn't set it. */
export const setCookieLine = (response: Response, name: string): string | undefined => {
  // Typed as a single string, but Node returns every Set-Cookie line as an array.
  const header: unknown = response.get('Set-Cookie');
  const lines = Array.isArray(header) ? header.filter((line) => typeof line === 'string') : [];
  return lines.find((line) => line.startsWith(`${name}=`));
};
