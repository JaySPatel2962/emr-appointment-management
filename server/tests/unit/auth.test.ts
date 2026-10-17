import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROLES } from '#app/constants/roles.js';
import { authenticate } from '#app/middlewares/authenticate.js';
import { authorize } from '#app/middlewares/authorize.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from '#app/services/token.service.js';
import type { AuthUser } from '#app/types/auth.js';

const doctor: AuthUser = {
  id: '665f1a2b3c4d5e6f7a8b9c0d',
  role: ROLES.DOCTOR,
  doctorId: '665f1a2b3c4d5e6f7a8b9c0e',
};

const requestWith = (headers: Record<string, string>, user?: AuthUser): Request =>
  ({
    get: (name: string) => headers[name.toLowerCase()],
    ...(user ? { user } : {}),
  }) as unknown as Request;

/** Runs a middleware and returns what it passed to next(): undefined, or an error. */
const run = (handler: RequestHandler, req: Request): unknown => {
  // Untyped on purpose: Express's NextFunction is overloaded, which a typed mock can't match.
  const next = vi.fn();
  void handler(req, {} as Response, next);
  const calls: unknown[][] = next.mock.calls;
  return calls[0]?.[0];
};

afterEach(() => {
  vi.useRealTimers();
});

describe('access tokens', () => {
  it('round-trip the user, including the doctor profile id', () => {
    expect(verifyAccessToken(signAccessToken(doctor))).toEqual(doctor);
  });

  it('expire after their configured lifetime', () => {
    vi.useFakeTimers();
    const token = signAccessToken(doctor);

    vi.advanceTimersByTime(16 * 60 * 1000);

    expect(() => verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it('cannot be replaced by a refresh token', () => {
    const { token } = signRefreshToken(doctor.id);

    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError);
  });
});

describe('authenticate', () => {
  it('rejects a request without a bearer token', () => {
    expect(run(authenticate, requestWith({}))).toMatchObject({ statusCode: 401 });
  });

  it('sets req.user from a valid token', () => {
    const req = requestWith({ authorization: `Bearer ${signAccessToken(doctor)}` });

    expect(run(authenticate, req)).toBeUndefined();
    expect(req.user).toEqual(doctor);
  });
});

describe('authorize', () => {
  it('lets listed roles through and forbids every other role', () => {
    expect(run(authorize(ROLES.DOCTOR), requestWith({}, doctor))).toBeUndefined();
    expect(run(authorize(ROLES.SUPER_ADMIN), requestWith({}, doctor))).toMatchObject({
      statusCode: 403,
    });
  });
});
