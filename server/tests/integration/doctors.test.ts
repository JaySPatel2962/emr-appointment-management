import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { UserModel } from '#app/models/user.model.js';

import { authorizationFor, loginAs } from '../helpers/auth.js';
import { createDepartment, createDoctor, createUser } from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

const app = createApp();
const DOCTORS_URL = '/api/v1/doctors';
const UNKNOWN_ID = '665f1a2b3c4d5e6f7a8b9c0d';

const rangeSchema = z.object({ start: z.string(), end: z.string() });
const doctorSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  specialization: z.string(),
  department: z.object({ id: z.string(), name: z.string() }),
  slotDurationMinutes: z.number(),
  schedule: z.array(
    z.object({
      dayOfWeek: z.number(),
      sessions: z.array(rangeSchema),
      breaks: z.array(rangeSchema),
    }),
  ),
  scheduleVersion: z.number(),
});
const doctorListSchema = z.array(doctorSchema);

const mondaySchedule = [
  {
    dayOfWeek: 1,
    sessions: [
      { start: '09:00', end: '12:00' },
      { start: '13:00', end: '17:00' },
    ],
    breaks: [{ start: '12:00', end: '13:00' }],
  },
];

const newDoctor = (departmentId: string, overrides: Record<string, unknown> = {}) => ({
  name: 'Dr. Kavya Mehta',
  email: 'kavya@clinic.test',
  password: 'Password123',
  departmentId,
  specialization: 'Cardiology',
  slotDurationMinutes: 15,
  schedule: mondaySchedule,
  ...overrides,
});

const asAdmin = async (): Promise<string> => authorizationFor(await createUser(ROLES.SUPER_ADMIN));

describe('POST /api/v1/doctors', () => {
  it('creates the account and the profile, and the new doctor can log in', async () => {
    const department = await createDepartment('Cardiology');

    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', await asAdmin())
      .send(newDoctor(department._id.toString()));

    expect(res.status).toBe(201);
    expect(dataOf(res, doctorSchema)).toMatchObject({
      name: 'Dr. Kavya Mehta',
      specialization: 'Cardiology',
      department: { name: 'Cardiology' },
      schedule: mondaySchedule,
    });
    const session = await loginAs(app, 'kavya@clinic.test', 'Password123');
    expect(session.accessToken).not.toBe('');
    expect(
      await AuditLogModel.countDocuments({
        action: AUDIT_ACTIONS.CREATE,
        entity: AUDIT_ENTITIES.DOCTOR,
      }),
    ).toBe(1);
  });

  it('saves neither the account nor the profile when the profile fails', async () => {
    const department = await createDepartment();
    const authorization = await asAdmin();
    vi.spyOn(DoctorModel, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', authorization)
      .send(newDoctor(department._id.toString()));

    expect(res.status).toBe(500);
    expect(await UserModel.countDocuments({ email: 'kavya@clinic.test' })).toBe(0);
  });

  it('rejects a duplicate email with 409 and keeps a single account', async () => {
    const department = await createDepartment();
    await createUser(ROLES.RECEPTIONIST, { email: 'kavya@clinic.test' });

    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', await asAdmin())
      .send(newDoctor(department._id.toString()));

    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe('A record with the same email already exists');
    expect(await UserModel.countDocuments({ email: 'kavya@clinic.test' })).toBe(1);
    expect(await DoctorModel.countDocuments()).toBe(0);
  });

  it('returns 422 for a department that does not exist', async () => {
    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', await asAdmin())
      .send(newDoctor(UNKNOWN_ID));

    expect(res.status).toBe(422);
  });

  it('rejects an invalid schedule with the exact path of the problem', async () => {
    const department = await createDepartment();
    const schedule = [
      {
        dayOfWeek: 1,
        sessions: [{ start: '09:00', end: '12:00' }],
        breaks: [{ start: '18:00', end: '18:30' }],
      },
    ];

    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', await asAdmin())
      .send(newDoctor(department._id.toString(), { schedule }));

    expect(res.status).toBe(400);
    expect(bodyOf(res).meta.errors).toEqual([
      {
        field: 'body.schedule.0.breaks.0',
        message: 'Break 18:00-18:30 must fall within working hours 09:00-12:00',
      },
    ]);
  });

  it('is reserved for Super Admins', async () => {
    const department = await createDepartment();
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));

    const res = await request(app)
      .post(DOCTORS_URL)
      .set('Authorization', receptionist)
      .send(newDoctor(department._id.toString()));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/doctors', () => {
  it('filters by department, searches by name and paginates', async () => {
    const cardiology = await createDepartment('Cardiology');
    const dermatology = await createDepartment('Dermatology');
    await createDoctor({ departmentId: cardiology._id, name: 'Dr. Asha Rao' });
    await createDoctor({ departmentId: cardiology._id, name: 'Dr. Vikram Shah' });
    await createDoctor({ departmentId: dermatology._id, name: 'Dr. Asha Iyer' });
    const authorization = authorizationFor(await createUser(ROLES.RECEPTIONIST));

    const firstPage = await request(app)
      .get(DOCTORS_URL)
      .query({ departmentId: cardiology._id.toString(), limit: 1 })
      .set('Authorization', authorization);
    const search = await request(app)
      .get(DOCTORS_URL)
      .query({ search: 'asha' })
      .set('Authorization', authorization);

    expect(dataOf(firstPage, doctorListSchema).map((doctor) => doctor.name)).toEqual([
      'Dr. Asha Rao',
    ]);
    expect(bodyOf(firstPage).meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(dataOf(search, doctorListSchema).map((doctor) => doctor.name)).toEqual([
      'Dr. Asha Iyer',
      'Dr. Asha Rao',
    ]);
  });

  it('shows a doctor only their own profile', async () => {
    const { user, doctor } = await createDoctor();
    await createDoctor();

    const res = await request(app)
      .get(DOCTORS_URL)
      .set('Authorization', authorizationFor(user, doctor._id));

    expect(dataOf(res, doctorListSchema).map((listed) => listed.id)).toEqual([
      doctor._id.toString(),
    ]);
  });
});

describe('GET /api/v1/doctors/:id', () => {
  it("answers 404 when a doctor asks for another doctor's profile", async () => {
    const { user, doctor } = await createDoctor();
    const { doctor: other } = await createDoctor();
    const authorization = authorizationFor(user, doctor._id);

    const own = await request(app)
      .get(`${DOCTORS_URL}/${doctor._id.toString()}`)
      .set('Authorization', authorization);
    const foreign = await request(app)
      .get(`${DOCTORS_URL}/${other._id.toString()}`)
      .set('Authorization', authorization);

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(404);
  });
});

describe('PUT /api/v1/doctors/:id/schedule', () => {
  it('replaces the schedule and the slot length, and audits the change', async () => {
    const { doctor } = await createDoctor();
    const schedule = [{ dayOfWeek: 3, sessions: [{ start: '10:00', end: '14:00' }], breaks: [] }];

    const res = await request(app)
      .put(`${DOCTORS_URL}/${doctor._id.toString()}/schedule`)
      .set('Authorization', await asAdmin())
      .send({ schedule, slotDurationMinutes: 20, scheduleVersion: 0 });

    expect(res.status).toBe(200);
    expect(dataOf(res, doctorSchema)).toMatchObject({
      schedule,
      slotDurationMinutes: 20,
      scheduleVersion: 1,
    });
    const audit = await AuditLogModel.findOne({
      action: AUDIT_ACTIONS.UPDATE,
      entityId: doctor._id,
    }).lean();
    expect(audit?.metadata).toEqual({ fields: ['schedule', 'slotDurationMinutes'] });
  });

  it('returns 404 for an unknown doctor', async () => {
    const res = await request(app)
      .put(`${DOCTORS_URL}/${UNKNOWN_ID}/schedule`)
      .set('Authorization', await asAdmin())
      .send({ schedule: mondaySchedule, scheduleVersion: 0 });

    expect(res.status).toBe(404);
  });
});
