import { createHmac } from 'node:crypto';

import type { ApiUser } from './api';

// The API's access tokens: HS256 JWTs from token.service.ts, with these issuer and audience.
const ISSUER = 'emr-appointments-api';
const AUDIENCE = 'emr-access';

const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * A genuine access token for `user` that expired a minute ago, signed with the test API's own
 * secret: what a browser holds after its 15 minutes run out.
 */
export const expiredAccessToken = (user: ApiUser, secret: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: user.id,
    role: user.role,
    ...(user.doctorId === undefined ? {} : { doctorId: user.doctorId }),
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now - 16 * 60,
    exp: now - 60,
  });
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};
