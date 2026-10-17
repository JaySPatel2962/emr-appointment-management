import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { APPOINTMENT_EVENTS } from '#app/constants/events.js';
import { ROLES } from '#app/constants/roles.js';
import {
  resetAppointmentEventEmitter,
  setAppointmentEventEmitter,
} from '#app/services/appointment-events.js';
import type { AppointmentEventEmitter } from '#app/services/appointment-events.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createPatient, createUser } from '../helpers/factories.js';
import { dataOf } from '../helpers/http.js';

const app = createApp();
const URL = '/api/v1/appointments';
const UNKNOWN_ID = '665f1a2b3c4d5e6f7a8b9c0d';

afterEach(() => {
  resetAppointmentEventEmitter();
});

const mockEmitter = () => {
  const publish = vi.fn<AppointmentEventEmitter['publish']>();
  setAppointmentEventEmitter({ publish });
  return publish;
};

const setUp = async () => {
  const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
  const patient = await createPatient();
  return {
    authorization: authorizationFor(await createUser(ROLES.RECEPTIONIST)),
    body: {
      doctorId: doctor._id.toString(),
      date: '2030-01-15',
      slotStart: '13:30',
      purpose: 'Follow-up',
      notes: 'Private clinical note',
      patientId: patient._id.toString(),
    },
  };
};

describe('appointment events', () => {
  it('announces each saved change, without the clinical notes', async () => {
    const publish = mockEmitter();
    const { authorization, body } = await setUp();

    const booked = await request(app).post(URL).set('Authorization', authorization).send(body);
    const { id } = dataOf(booked, z.object({ id: z.string() }));
    await request(app)
      .put(`${URL}/${id}`)
      .set('Authorization', authorization)
      .send({ notes: 'Still private' });
    await request(app).post(`${URL}/${id}/arrive`).set('Authorization', authorization);
    await request(app).delete(`${URL}/${id}`).set('Authorization', authorization);

    expect(publish.mock.calls.map(([event]) => event)).toEqual([
      APPOINTMENT_EVENTS.CREATED,
      APPOINTMENT_EVENTS.UPDATED,
      APPOINTMENT_EVENTS.UPDATED,
      APPOINTMENT_EVENTS.CANCELLED,
    ]);
    expect(publish.mock.calls.some(([, appointment]) => 'notes' in appointment)).toBe(false);
  });

  it('announces nothing when a change fails', async () => {
    const publish = mockEmitter();
    const { authorization, body } = await setUp();

    await request(app).post(URL).set('Authorization', authorization).send(body);
    const doubleBooking = await request(app)
      .post(URL)
      .set('Authorization', authorization)
      .send(body);
    const unknown = await request(app)
      .post(`${URL}/${UNKNOWN_ID}/arrive`)
      .set('Authorization', authorization);

    expect(doubleBooking.status).toBe(409);
    expect(unknown.status).toBe(404);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('never fails a request because the broadcast failed', async () => {
    setAppointmentEventEmitter({
      publish: () => {
        throw new Error('Socket layer unavailable');
      },
    });
    const { authorization, body } = await setUp();

    const res = await request(app).post(URL).set('Authorization', authorization).send(body);

    expect(res.status).toBe(201);
  });
});
