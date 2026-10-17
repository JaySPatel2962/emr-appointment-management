import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { ROLES } from '#app/constants/roles.js';

import { authorizationFor } from '../helpers/auth.js';
import {
  createAppointment,
  createDepartment,
  createDoctor,
  createUser,
} from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

const app = createApp();
const SLOTS_URL = '/api/v1/slots';
const TODAY = '2030-01-15'; // a Tuesday
// 10:07 in the clinic (Asia/Kolkata is UTC+5:30).
const NOW = new Date('2030-01-15T04:37:00Z');

const daySlotsSchema = z.object({
  doctorId: z.string(),
  date: z.string(),
  timezone: z.string(),
  slotDurationMinutes: z.number(),
  slots: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
      status: z.string(),
      appointmentId: z.string().optional(),
    }),
  ),
});

beforeEach(() => {
  // Only Date is faked, so MongoDB's own timers keep running.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const receptionist = async (): Promise<string> =>
  authorizationFor(await createUser(ROLES.RECEPTIONIST));

const getSlots = (authorization: string, query: Record<string, string>) =>
  request(app).get(SLOTS_URL).query(query).set('Authorization', authorization);

describe('GET /api/v1/slots', () => {
  it("marks today's slots as past, booked or available", async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
    const booked = await createAppointment(doctor, {
      date: TODAY,
      slotStart: '13:30',
      slotEnd: '14:00',
    });

    const res = await getSlots(await receptionist(), {
      doctorId: doctor._id.toString(),
      date: TODAY,
    });

    expect(res.status).toBe(200);
    const { slots, timezone } = dataOf(res, daySlotsSchema);
    expect(timezone).toBe('Asia/Kolkata');
    // 09:00-12:00 and 13:00-17:00 in 30-minute slots, with nothing during lunch.
    expect(slots.map((slot) => slot.start)).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
    ]);
    // At 10:07 the 10:00 slot has already started.
    expect(slots.slice(2, 4)).toEqual([
      { start: '10:00', end: '10:30', status: 'PAST' },
      { start: '10:30', end: '11:00', status: 'AVAILABLE' },
    ]);
    expect(slots.find((slot) => slot.start === '13:30')).toEqual({
      start: '13:30',
      end: '14:00',
      status: 'BOOKED',
      appointmentId: booked._id.toString(),
    });
  });

  it('offers a cancelled slot again', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
    await createAppointment(doctor, {
      date: TODAY,
      slotStart: '13:30',
      slotEnd: '14:00',
      status: APPOINTMENT_STATUS.CANCELLED,
    });

    const res = await getSlots(await receptionist(), {
      doctorId: doctor._id.toString(),
      date: TODAY,
    });

    expect(dataOf(res, daySlotsSchema).slots.find((slot) => slot.start === '13:30')?.status).toBe(
      'AVAILABLE',
    );
  });

  it('has no slots on a day off', async () => {
    const { doctor } = await createDoctor({
      schedule: [{ dayOfWeek: 1, sessions: [{ start: '09:00', end: '12:00' }], breaks: [] }],
    });

    const res = await getSlots(await receptionist(), {
      doctorId: doctor._id.toString(),
      date: TODAY,
    });

    expect(dataOf(res, daySlotsSchema).slots).toEqual([]);
  });

  it('rejects a past date with 422', async () => {
    const { doctor } = await createDoctor();

    const res = await getSlots(await receptionist(), {
      doctorId: doctor._id.toString(),
      date: '2030-01-14',
    });

    expect(res.status).toBe(422);
  });

  it('lets a doctor see only their own slots', async () => {
    const { user, doctor } = await createDoctor();
    const { doctor: other } = await createDoctor();
    const authorization = authorizationFor(user, doctor._id);

    const own = await getSlots(authorization, { doctorId: doctor._id.toString(), date: TODAY });
    const foreign = await getSlots(authorization, { doctorId: other._id.toString(), date: TODAY });

    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
  });

  it('checks the department when one is given', async () => {
    const { doctor } = await createDoctor();
    const otherDepartment = await createDepartment();

    const res = await getSlots(await receptionist(), {
      doctorId: doctor._id.toString(),
      date: TODAY,
      departmentId: otherDepartment._id.toString(),
    });

    expect(res.status).toBe(404);
  });

  it('validates the query', async () => {
    const res = await getSlots(await receptionist(), { date: '2030-02-30' });

    expect(res.status).toBe(400);
    expect(bodyOf(res).meta.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'query.doctorId' }),
        expect.objectContaining({ field: 'query.date' }),
      ]),
    );
  });
});
