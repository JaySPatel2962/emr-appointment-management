import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';
import { PatientModel } from '#app/models/patient.model.js';
import { backfillNameWords } from '#app/services/name-words-backfill.service.js';

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

  // Found in manual QA (Q-03): "Rao" found nobody, because only the start of the full name matched.
  it('finds a patient by the start of any word of the name, in any order', async () => {
    await createPatient({ name: 'Asha Rao', mobile: '9876543210' });
    await createPatient({ name: 'Arjun Rao', mobile: '9876543211' });
    await createPatient({ name: 'José Álvarez', mobile: '9876543212' });
    await createPatient({ name: "Zoë O'Brien-Smith", mobile: '9876543213' });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));

    expect(await namesFor(receptionist, 'Rao')).toEqual(['Arjun Rao', 'Asha Rao']);
    expect(await namesFor(receptionist, 'rao asha')).toEqual(['Asha Rao']);
    expect(await namesFor(receptionist, 'Asha Rao')).toEqual(['Asha Rao']);
    expect(await namesFor(receptionist, 'a r')).toEqual(['Arjun Rao', 'Asha Rao']);
    expect(await namesFor(receptionist, 'jose')).toEqual(['José Álvarez']);
    expect(await namesFor(receptionist, 'Álv')).toEqual(['José Álvarez']);
    expect(await namesFor(receptionist, 'smith')).toEqual(["Zoë O'Brien-Smith"]);
    expect(await namesFor(receptionist, 'sha')).toEqual([]);
  });

  it('fills in the name words of patients and appointments saved before word search', async () => {
    const asha = await createPatient({ name: 'Asha Rao' });
    await PatientModel.collection.updateOne({ _id: asha._id }, { $unset: { nameWords: '' } });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));
    expect(await namesFor(receptionist, 'rao')).toEqual([]);

    const first = await backfillNameWords();
    const again = await backfillNameWords();

    expect(first.patients).toEqual({ checked: 1, updated: 1 });
    expect(again.patients).toEqual({ checked: 1, updated: 0 });
    expect(await namesFor(receptionist, 'rao')).toEqual(['Asha Rao']);
  });

  // Found in manual QA: "--" was read as a mobile number with an empty prefix, and matched all.
  it('reads separators without a digit as a name, not as a mobile number', async () => {
    await createPatient({ name: 'Asha Rao', mobile: '9876543210' });
    await createPatient({ name: 'Ravi Shah', mobile: '9123456789' });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));

    for (const term of ['--', '()', '.', '+']) {
      expect(await namesFor(receptionist, term)).toEqual([]);
    }
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
