import type { Express } from 'express';
import type { Types } from 'mongoose';
import request from 'supertest';
import type { Response } from 'supertest';
import { z } from 'zod';

import type { Role } from '#app/constants/roles.js';
import { signAccessToken } from '#app/services/token.service.js';
import { REFRESH_COOKIE_NAME } from '#app/utils/refresh-cookie.js';

import { TEST_PASSWORD } from './factories.js';
import { dataOf, setCookieLine } from './http.js';

export const LOGIN_URL = '/api/v1/auth/login';

export interface TestSession {
  accessToken: string;
  refreshCookie: string;
}

export const bearer = (accessToken: string): string => `Bearer ${accessToken}`;

/** An Authorization header for a user, signed directly so tests don't need to log in first. */
export const authorizationFor = (
  user: { _id: Types.ObjectId; role: Role },
  doctorId?: Types.ObjectId,
): string =>
  bearer(
    signAccessToken({
      id: user._id.toString(),
      role: user.role,
      ...(doctorId === undefined ? {} : { doctorId: doctorId.toString() }),
    }),
  );

/** "emr_refresh=<token>" from a response, ready to send back in a Cookie header. */
export const refreshCookieFrom = (response: Response): string => {
  const cookie = setCookieLine(response, REFRESH_COOKIE_NAME)?.split(';')[0];
  if (cookie === undefined) {
    throw new Error('The response did not set the refresh cookie');
  }
  return cookie;
};

/** Logs in through the API; returns the access token and the refresh cookie. */
export const loginAs = async (
  app: Express,
  email: string,
  password = TEST_PASSWORD,
): Promise<TestSession> => {
  const response = await request(app).post(LOGIN_URL).send({ email, password });
  const { accessToken } = dataOf(response, z.object({ accessToken: z.string() }));
  return { accessToken, refreshCookie: refreshCookieFrom(response) };
};
