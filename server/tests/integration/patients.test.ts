import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createPatient, createUser } from '../helpers/factories.js';
import { dataOf } from '../helpers/http.js';

const app = createApp();
const PATIENTS_URL = '/api/v1/patients';

const patientListSchema = z.array(
  z.object({
    id: z.string(),
    patientCode: z.string(),
    name: z.string(),
    mobile: z.string(),
    gender: z.string(),
    dateOfBirth: z.string().nullable(),
  }),
);

const namesFor = async (authorization: string, search?: string): Promise<string[]> => {
  const res = await request(app)
    .get(PATIENTS_URL)
    .query(search === undefined ? {} : { search })
    .set('Authorization', authorization);
  return dataOf(res, patientListSchema).map((patient) => patient.name);
};

describe('GET /api/v1/patients', () => {
  it('finds patients by code, by the start of a mobile number or by the start of a name', async () => {
    await createPatient({ patientCode: 'PAT-000042', name: 'Asha Rao', mobile: '9876543210' });
    await createPatient({ name: 'Ashok Kumar', mobile: '9123456789' });
    await createPatient({ name: 'Ravi Shah', mobile: '9876500000' });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));

    expect(await namesFor(receptionist, 'pat-000042')).toEqual(['Asha Rao']);
    expect(await namesFor(receptionist, '+91 98765')).toEqual(['Asha Rao', 'Ravi Shah']);
    expect(await namesFor(receptionist, 'ash')).toEqual(['Asha Rao', 'Ashok Kumar']);
  });

  it('lists every patient by name, ignoring case, when there is no search term', async () => {
    await createPatient({ name: 'Zara Khan' });
    await createPatient({ name: 'asha rao' });
    const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));

    expect(await namesFor(admin)).toEqual(['asha rao', 'Zara Khan']);
  });

  it('is for front-desk staff only', async () => {
    const { user, doctor } = await createDoctor();

    const res = await request(app)
      .get(PATIENTS_URL)
      .set('Authorization', authorizationFor(user, doctor._id));

    expect(res.status).toBe(403);
  });
});
