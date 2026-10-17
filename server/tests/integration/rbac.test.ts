import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';
import type { Role } from '#app/constants/roles.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createUser } from '../helpers/factories.js';
import { bodyOf } from '../helpers/http.js';

const app = createApp();
const ID = '665f1a2b3c4d5e6f7a8b9c0d';

interface Endpoint {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
}

const send = (endpoint: Endpoint, authorization?: string) => {
  const req = request(app)[endpoint.method](endpoint.path);
  return authorization === undefined ? req : req.set('Authorization', authorization);
};

const label = (endpoint: Endpoint): string => `${endpoint.method.toUpperCase()} ${endpoint.path}`;

const PROTECTED: Endpoint[] = [
  { method: 'get', path: '/api/v1/departments' },
  { method: 'post', path: '/api/v1/users/receptionists' },
  { method: 'get', path: '/api/v1/doctors' },
  { method: 'post', path: '/api/v1/doctors' },
  { method: 'get', path: `/api/v1/doctors/${ID}` },
  { method: 'put', path: `/api/v1/doctors/${ID}/schedule` },
  { method: 'get', path: '/api/v1/slots' },
  { method: 'get', path: '/api/v1/patients' },
  { method: 'get', path: '/api/v1/appointments' },
  { method: 'post', path: '/api/v1/appointments' },
  { method: 'get', path: `/api/v1/appointments/${ID}` },
  { method: 'put', path: `/api/v1/appointments/${ID}` },
  { method: 'delete', path: `/api/v1/appointments/${ID}` },
  { method: 'post', path: `/api/v1/appointments/${ID}/arrive` },
  { method: 'post', path: `/api/v1/appointments/${ID}/complete` },
];

// Each restricted endpoint, with the roles it must turn away.
const RESTRICTED: { endpoint: Endpoint; deniedRoles: Role[] }[] = [
  {
    endpoint: { method: 'post', path: '/api/v1/users/receptionists' },
    deniedRoles: [ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  {
    endpoint: { method: 'post', path: '/api/v1/doctors' },
    deniedRoles: [ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  {
    endpoint: { method: 'put', path: `/api/v1/doctors/${ID}/schedule` },
    deniedRoles: [ROLES.RECEPTIONIST, ROLES.DOCTOR],
  },
  { endpoint: { method: 'get', path: '/api/v1/patients' }, deniedRoles: [ROLES.DOCTOR] },
  { endpoint: { method: 'post', path: '/api/v1/appointments' }, deniedRoles: [ROLES.DOCTOR] },
  {
    endpoint: { method: 'delete', path: `/api/v1/appointments/${ID}` },
    deniedRoles: [ROLES.DOCTOR],
  },
  {
    endpoint: { method: 'post', path: `/api/v1/appointments/${ID}/arrive` },
    deniedRoles: [ROLES.DOCTOR],
  },
  {
    endpoint: { method: 'post', path: `/api/v1/appointments/${ID}/complete` },
    deniedRoles: [ROLES.RECEPTIONIST],
  },
];

const authorizationForRole = async (role: Role): Promise<string> => {
  if (role === ROLES.DOCTOR) {
    const { user, doctor } = await createDoctor();
    return authorizationFor(user, doctor._id);
  }
  return authorizationFor(await createUser(role));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('authentication on every protected endpoint', () => {
  it.each(PROTECTED.map((endpoint) => [label(endpoint), endpoint] as const))(
    '%s answers 401 without a token',
    async (_label, endpoint) => {
      const res = await send(endpoint);

      expect(res.status).toBe(401);
    },
  );

  it('answers 401 to an expired token and to a tampered one', async () => {
    const user = await createUser(ROLES.SUPER_ADMIN);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-15T00:00:00Z'));
    const authorization = authorizationFor(user);
    const tampered = `${authorization.slice(0, -4)}AAAA`;

    const withTampered = await send({ method: 'get', path: '/api/v1/doctors' }, tampered);
    vi.setSystemTime(new Date('2030-01-15T00:16:00Z'));
    const withExpired = await send({ method: 'get', path: '/api/v1/doctors' }, authorization);

    expect(withTampered.status).toBe(401);
    expect(bodyOf(withTampered).message).toBe('Invalid token');
    expect(withExpired.status).toBe(401);
    expect(bodyOf(withExpired).message).toBe('Token has expired');
  });
});

describe('role checks', () => {
  const cases = RESTRICTED.flatMap(({ endpoint, deniedRoles }) =>
    deniedRoles.map((role) => [`${role} on ${label(endpoint)}`, endpoint, role] as const),
  );

  // No body is sent: the role check runs before validation, so a denied caller learns nothing.
  it.each(cases)('turns away %s with 403', async (_label, endpoint, role) => {
    const res = await send(endpoint, await authorizationForRole(role));

    expect(res.status).toBe(403);
  });
});
