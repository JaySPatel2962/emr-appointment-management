import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';

import { bearer, loginAs } from '../helpers/auth.js';
import { createDepartment, createUser } from '../helpers/factories.js';
import { dataOf } from '../helpers/http.js';

const app = createApp();
const DATE = '2030-01-15'; // a Tuesday
const idSchema = z.object({ id: z.string() });

describe('a clinic day, end to end through the API', () => {
  it('runs from setting up staff to completing a visit, and audits every step', async () => {
    await createUser(ROLES.SUPER_ADMIN, { email: 'admin@clinic.test' });
    const department = await createDepartment('Cardiology');
    const asAdmin = bearer((await loginAs(app, 'admin@clinic.test')).accessToken);

    // The Super Admin sets up a doctor and a receptionist.
    const doctorRes = await request(app)
      .post('/api/v1/doctors')
      .set('Authorization', asAdmin)
      .send({
        name: 'Dr. Kavya Mehta',
        email: 'kavya@clinic.test',
        password: 'Password123',
        departmentId: department._id.toString(),
        specialization: 'Cardiology',
        slotDurationMinutes: 15,
        schedule: [{ dayOfWeek: 2, sessions: [{ start: '09:00', end: '12:00' }], breaks: [] }],
      });
    const { id: doctorId } = dataOf(doctorRes, idSchema);
    const receptionistRes = await request(app)
      .post('/api/v1/users/receptionists')
      .set('Authorization', asAdmin)
      .send({ name: 'Neha Patil', email: 'neha@clinic.test', password: 'Password123' });
    expect(receptionistRes.status).toBe(201);

    // The receptionist finds the first free slot and books it for a walk-in patient.
    const asReceptionist = bearer(
      (await loginAs(app, 'neha@clinic.test', 'Password123')).accessToken,
    );
    const { slots } = dataOf(
      await request(app)
        .get('/api/v1/slots')
        .query({ doctorId, date: DATE })
        .set('Authorization', asReceptionist),
      z.object({ slots: z.array(z.object({ start: z.string(), status: z.string() })) }),
    );
    const firstFree = slots.find((slot) => slot.status === 'AVAILABLE');
    expect(firstFree?.start).toBe('09:00');
    const booked = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', asReceptionist)
      .send({
        doctorId,
        date: DATE,
        slotStart: '09:00',
        purpose: 'Chest pain',
        newPatient: { name: 'Asha Rao', mobile: '98765 43210', gender: 'FEMALE' },
      });
    const { id: appointmentId } = dataOf(booked, idSchema);
    const arrived = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/arrive`)
      .set('Authorization', asReceptionist);
    expect(arrived.status).toBe(200);

    // The doctor sees the visit, writes notes and completes it.
    const asDoctor = bearer((await loginAs(app, 'kavya@clinic.test', 'Password123')).accessToken);
    const mine = dataOf(
      await request(app).get('/api/v1/appointments').set('Authorization', asDoctor),
      z.array(idSchema),
    );
    expect(mine.map((appointment) => appointment.id)).toEqual([appointmentId]);
    await request(app)
      .put(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', asDoctor)
      .send({ notes: 'ECG normal' });
    const completed = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/complete`)
      .set('Authorization', asDoctor);
    expect(dataOf(completed, z.object({ status: z.string(), notes: z.string() }))).toEqual({
      status: 'COMPLETED',
      notes: 'ECG normal',
    });

    // Every step left an audit entry, in order.
    const trail = await AuditLogModel.find({}, { action: 1, entity: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(trail.map((entry) => `${entry.action} ${entry.entity}`)).toEqual([
      'LOGIN USER',
      'CREATE DOCTOR',
      'CREATE USER',
      'LOGIN USER',
      'CREATE PATIENT',
      'CREATE APPOINTMENT',
      'ARRIVE APPOINTMENT',
      'LOGIN USER',
      'UPDATE APPOINTMENT',
      'COMPLETE APPOINTMENT',
    ]);
  });
});
