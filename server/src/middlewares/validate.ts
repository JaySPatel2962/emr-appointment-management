import type { Request, RequestHandler } from 'express';
import type { z } from 'zod';

/** Schema for the parts of a request an endpoint accepts: z.object({ body, query, params }). */
export type RequestSchema = z.ZodType<{ body?: unknown; query?: unknown; params?: unknown }>;

/** Parses body, query and params with the schema. A ZodError reaches the error handler as a 400. */
export const validate =
  (schema: RequestSchema): RequestHandler =>
  (req, _res, next) => {
    const data = schema.parse({ body: req.body as unknown, query: req.query, params: req.params });
    req.validated = { schema, data };
    next();
  };

/** Returns the input parsed by `validate(schema)`, typed from that same schema. */
export const getValidated = <S extends RequestSchema>(req: Request, schema: S): z.output<S> => {
  const { validated } = req;
  if (validated?.schema !== schema) {
    throw new Error('getValidated() was called with a schema that did not validate this request');
  }
  return validated.data as z.output<S>;
};
