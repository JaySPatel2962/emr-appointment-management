import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '#app/config/env.js';
import { ROLES } from '#app/constants/roles.js';
import type { AuthUser } from '#app/types/auth.js';
import { AppError } from '#app/utils/app-error.js';

// Access and refresh tokens use different secrets and audiences, so one can never pass as the other.
const ISSUER = 'emr-appointments-api';
const ACCESS_AUDIENCE = 'emr-access';
const REFRESH_AUDIENCE = 'emr-refresh';
// Pinning the algorithm rules out algorithm-confusion attacks such as "alg": "none".
const ALGORITHM = 'HS256';
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;

const accessClaimsSchema = z.object({
  sub: z.string(),
  role: z.enum(ROLES),
  doctorId: z.string().optional(),
});

const refreshClaimsSchema = z.object({ sub: z.string(), jti: z.string() });

export interface SignedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** Carries the role, and the doctor profile id for doctors, so requests need no user lookup. */
export const signAccessToken = (user: AuthUser): string =>
  jwt.sign(
    { role: user.role, ...(user.doctorId === undefined ? {} : { doctorId: user.doctorId }) },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: ALGORITHM,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
      subject: user.id,
    },
  );

/** Throws for a bad signature or an expired token; the error handler turns both into a 401. */
export const verifyAccessToken = (token: string): AuthUser => {
  const claims = accessClaimsSchema.safeParse(
    jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    }),
  );
  if (!claims.success) {
    throw AppError.unauthorized('Invalid token');
  }
  const { sub, role, doctorId } = claims.data;
  return { id: sub, role, ...(doctorId === undefined ? {} : { doctorId }) };
};

/** A random jti makes every refresh token unique, even two issued in the same second. */
export const signRefreshToken = (userId: string): SignedRefreshToken => {
  const ttlSeconds = env.REFRESH_TOKEN_TTL_DAYS * SECONDS_PER_DAY;
  const token = jwt.sign({}, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: ttlSeconds,
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
    subject: userId,
    jwtid: randomUUID(),
  });
  return { token, expiresAt: new Date(Date.now() + ttlSeconds * MS_PER_SECOND) };
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  const claims = refreshClaimsSchema.safeParse(
    jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    }),
  );
  if (!claims.success) {
    throw AppError.unauthorized('Invalid token');
  }
  return { userId: claims.data.sub };
};

/** Refresh tokens are stored only as this SHA-256 hash. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
