import type { Express } from 'express';
import request from 'supertest';
import type { Response } from 'supertest';
import { z } from 'zod';

import { REFRESH_COOKIE_NAME } from '#app/utils/refresh-cookie.js';

import { TEST_PASSWORD } from './factories.js';
import { dataOf, setCookieLine } from './http.js';

export const LOGIN_URL = '/api/v1/auth/login';

export interface TestSession {
  accessToken: string;
  refreshCookie: string;
}

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

export const bearer = (accessToken: string): string => `Bearer ${accessToken}`;
