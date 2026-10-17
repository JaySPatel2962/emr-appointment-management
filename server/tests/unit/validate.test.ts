import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';

import { getValidated, validate } from '#app/middlewares/validate.js';

const listSchema = z.object({ query: z.object({ page: z.coerce.number().int().min(1) }) });

const fakeRequest = (query: Record<string, string>): Request =>
  ({ body: undefined, query, params: {} }) as unknown as Request;
const fakeResponse = {} as Response;

describe('validate and getValidated', () => {
  it('stores the parsed input, which getValidated returns typed from the schema', () => {
    const req = fakeRequest({ page: '2' });
    const next = vi.fn();

    void validate(listSchema)(req, fakeResponse, next);

    expect(next).toHaveBeenCalledWith();
    expect(getValidated(req, listSchema).query.page).toBe(2);
  });

  it('throws a ZodError for invalid input', () => {
    expect(() => {
      void validate(listSchema)(fakeRequest({ page: '0' }), fakeResponse, vi.fn());
    }).toThrow(ZodError);
  });

  it('refuses to return data validated by a different schema', () => {
    const req = fakeRequest({ page: '1' });
    void validate(listSchema)(req, fakeResponse, vi.fn());

    expect(() => getValidated(req, z.object({}))).toThrow(/did not validate this request/);
  });
});
