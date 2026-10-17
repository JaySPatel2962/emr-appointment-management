import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';

import { authorizationFor, loginAs } from '../helpers/auth.js';
import { createDepartment, createUser } from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

const app = createApp();
const RECEPTIONISTS_URL = '/api/v1/users/receptionists';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

describe('POST /api/v1/users/receptionists', () => {
  it('creates a receptionist who can then log in', async () => {
    const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));

    const res = await request(app)
      .post(RECEPTIONISTS_URL)
      .set('Authorization', admin)
      .send({ name: 'Neha Patil', email: 'Neha@Clinic.test', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(dataOf(res, userSchema)).toMatchObject({
      name: 'Neha Patil',
      email: 'neha@clinic.test',
      role: ROLES.RECEPTIONIST,
    });
    expect(JSON.stringify(bodyOf(res))).not.toContain('password');
    const session = await loginAs(app, 'neha@clinic.test', 'Password123');
    expect(session.accessToken).not.toBe('');
  });

  it('enforces the password policy and unique emails', async () => {
    const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));
    await createUser(ROLES.DOCTOR, { email: 'taken@clinic.test' });

    const weak = await request(app)
      .post(RECEPTIONISTS_URL)
      .set('Authorization', admin)
      .send({ name: 'Weak', email: 'weak@clinic.test', password: 'short' });
    const duplicate = await request(app)
      .post(RECEPTIONISTS_URL)
      .set('Authorization', admin)
      .send({ name: 'Taken', email: 'taken@clinic.test', password: 'Password123' });

    expect(weak.status).toBe(400);
    expect(bodyOf(weak).meta.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'body.password' })]),
    );
    expect(duplicate.status).toBe(409);
  });
});

describe('GET /api/v1/departments', () => {
  it('lists departments by name, ignoring case, for any signed-in user', async () => {
    await createDepartment('Dermatology');
    await createDepartment('cardiology');

    const res = await request(app)
      .get('/api/v1/departments')
      .set('Authorization', authorizationFor(await createUser(ROLES.RECEPTIONIST)));

    const departments = dataOf(res, z.array(z.object({ id: z.string(), name: z.string() })));
    expect(departments.map((department) => department.name)).toEqual(['cardiology', 'Dermatology']);
  });

  it('requires a signed-in user', async () => {
    const res = await request(app).get('/api/v1/departments');

    expect(res.status).toBe(401);
  });
});
