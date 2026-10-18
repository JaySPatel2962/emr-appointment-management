import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api-error';
import { authSession } from '@/services/auth-session';
import { authHttp, http, refreshAccessToken } from '@/services/http';
import type { Session } from '@/types/models';

// A fake API behind the real axios instances and interceptors: it accepts exactly one access
// token at a time, and /auth/refresh hands out the next one after a short delay.

const sessionWith = (accessToken: string): Session => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { id: 'u1', name: 'Priya Nair', email: 'priya@clinic.example', role: 'RECEPTIONIST' },
});

const respond = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
): Promise<AxiosResponse> => {
  const response: AxiosResponse = { data, status, statusText: '', headers: {}, config };
  return status < 400
    ? Promise.resolve(response)
    : Promise.reject(
        new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response),
      );
};

const success = (data: unknown) => ({ success: true, message: 'OK', data, meta: {} });
const failure = (message: string) => ({
  success: false,
  message,
  data: null,
  meta: { requestId: 'req-1' },
});

let validToken: string;
let refreshCalls: number;
let refreshFails: boolean;
let tokensSeen: (string | null)[];

const apiAdapter: AxiosAdapter = (config) => {
  const header = config.headers.get('Authorization');
  tokensSeen.push(typeof header === 'string' ? header : null);
  return header === `Bearer ${validToken}`
    ? respond(config, 200, success({ url: config.url }))
    : respond(config, 401, failure('Token has expired'));
};

const authAdapter: AxiosAdapter = async (config) => {
  refreshCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 10));
  if (refreshFails) {
    return respond(config, 401, failure('Your session has expired, please log in again'));
  }
  validToken = `token-${refreshCalls + 1}`;
  return respond(config, 200, success(sessionWith(validToken)));
};

beforeEach(() => {
  http.defaults.adapter = apiAdapter;
  authHttp.defaults.adapter = authAdapter;
  validToken = 'token-1';
  refreshCalls = 0;
  refreshFails = false;
  tokensSeen = [];
  authSession.start(sessionWith('token-1'));
});

describe('the HTTP client', () => {
  it('sends the access token from memory', async () => {
    await http.get('/departments');

    expect(tokensSeen).toEqual(['Bearer token-1']);
  });

  it('refreshes once for parallel 401s, then retries every one of them', async () => {
    validToken = 'token-2'; // the server no longer accepts token-1

    const results = await Promise.all(
      ['/doctors', '/slots', '/appointments'].map((url) => http.get(url)),
    );

    expect(refreshCalls).toBe(1);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect(authSession.getAccessToken()).toBe('token-2');
  });

  it('holds a request that starts during a refresh until the new token arrives', async () => {
    const refresh = refreshAccessToken();
    const response = await http.get('/departments');
    await refresh;

    expect(response.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(tokensSeen).toEqual(['Bearer token-2']);
  });

  it('ends the session when the refresh cookie is refused', async () => {
    validToken = 'token-2';
    refreshFails = true;

    const request = http.get('/appointments');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(authSession.getState()).toMatchObject({ status: 'anonymous', endReason: 'expired' });
    expect(authSession.getAccessToken()).toBeNull();
  });

  it('retries a request only once, even if the new token is refused too', async () => {
    let requests = 0;
    http.defaults.adapter = (config) => {
      requests += 1;
      return respond(config, 401, failure('Invalid token'));
    };

    await expect(http.get('/appointments')).rejects.toMatchObject({ status: 401 });
    expect(requests).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('turns other failures into ApiErrors with the server message and request id', async () => {
    http.defaults.adapter = (config) => respond(config, 409, failure('Slot already booked'));

    await expect(http.post('/appointments', {})).rejects.toMatchObject({
      status: 409,
      message: 'Slot already booked',
      requestId: 'req-1',
    });
    expect(refreshCalls).toBe(0);
  });
});
