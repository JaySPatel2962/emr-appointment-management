import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { AUDIT_ACTIONS } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import type { DaySchedule } from '#app/utils/schedule.js';

import { authorizationFor } from '../helpers/auth.js';
import {
  createAppointment,
  createDoctor,
  createUser,
  FULL_WEEK_SCHEDULE,
} from '../helpers/factories.js';
import { bodyOf } from '../helpers/http.js';

// Found in manual QA (A-20): a schedule change kept booked appointments that no longer fit. They
// vanished from the day sheet, and their time could be booked a second time. A change that
// would strand an appointment still to happen is now refused.

const app = createApp();
const TODAY = '2030-01-14'; // a Monday
const TUESDAY = '2030-01-15';
// 10:00 in the clinic (Asia/Kolkata is UTC+5:30).
const NOW = new Date('2030-01-14T04:30:00Z');

const strandedSchema = z.array(
  z.object({
    id: z.string(),
    date: z.string(),
    slotStart: z.string(),
    slotEnd: z.string(),
    status: z.string(),
    patient: z.object({ id: z.string(), patientCode: z.string(), name: z.string() }),
  }),
);

beforeEach(() => {
  // Only Date is faked, so MongoDB's own timers keep running.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A doctor working every day, 09:00-12:00 and 13:00-17:00 in 15-minute slots, and a booking. */
const setUp = async (booked: { date?: string; slotStart?: string; slotEnd?: string } = {}) => {
  const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
  const appointment = await createAppointment(doctor, {
    date: booked.date ?? TUESDAY,
    slotStart: booked.slotStart ?? '10:30',
    slotEnd: booked.slotEnd ?? '10:45',
    patientName: 'Pooja Nair',
  });
  return { doctor, appointment, admin: authorizationFor(await createUser(ROLES.SUPER_ADMIN)) };
};

/** Saves a schedule from the doctor's current version, as the editor does after loading it. */
const putSchedule = async (
  admin: string,
  doctorId: string,
  body: { schedule: DaySchedule[]; slotDurationMinutes?: number },
) => {
  const doctor = await DoctorModel.findById(doctorId, { scheduleVersion: 1 }).lean();
  return request(app)
    .put(`/api/v1/doctors/${doctorId}/schedule`)
    .set('Authorization', admin)
    .send({ ...body, scheduleVersion: doctor?.scheduleVersion ?? 0 });
};

const withDay = (dayOfWeek: number, day: Omit<DaySchedule, 'dayOfWeek'> | null): DaySchedule[] =>
  FULL_WEEK_SCHEDULE.flatMap((entry) => {
    if (entry.dayOfWeek !== dayOfWeek) {
      return [entry];
    }
    return day ? [{ ...day, dayOfWeek }] : [];
  });

describe('PUT /api/v1/doctors/:id/schedule with booked appointments', () => {
  it('refuses a slot length that leaves a booking off the grid, and lists it', async () => {
    const { doctor, appointment, admin } = await setUp();

    const res = await putSchedule(admin, doctor._id.toString(), {
      schedule: FULL_WEEK_SCHEDULE,
      slotDurationMinutes: 20,
    });

    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe(
      'This schedule would leave 1 booked appointment without its slot',
    );
    expect(strandedSchema.parse(bodyOf(res).meta.appointments)).toEqual([
      {
        id: appointment._id.toString(),
        date: TUESDAY,
        slotStart: '10:30',
        slotEnd: '10:45',
        status: APPOINTMENT_STATUS.SCHEDULED,
        patient: {
          id: appointment.patientId.toString(),
          patientCode: appointment.patientCode,
          name: 'Pooja Nair',
        },
      },
    ]);
    const saved = await DoctorModel.findById(doctor._id).lean();
    expect(saved?.slotDurationMinutes).toBe(15);
  });

  it('needs the same end too: 30-minute slots start at 10:30 but end at 11:00', async () => {
    const { doctor, admin } = await setUp();

    const res = await putSchedule(admin, doctor._id.toString(), {
      schedule: FULL_WEEK_SCHEDULE,
      slotDurationMinutes: 30,
    });

    expect(res.status).toBe(409);
  });

  it('refuses removing a day that has a booking', async () => {
    const { doctor, admin } = await setUp();

    const res = await putSchedule(admin, doctor._id.toString(), { schedule: withDay(2, null) });

    expect(res.status).toBe(409);
    expect(strandedSchema.parse(bodyOf(res).meta.appointments)).toHaveLength(1);
    const saved = await DoctorModel.findById(doctor._id).lean();
    expect(saved?.schedule.map((day) => day.dayOfWeek)).toContain(2);
  });

  it('refuses a break placed over a booking', async () => {
    const { doctor, admin } = await setUp();
    const tuesday = withDay(2, {
      sessions: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '17:00' },
      ],
      breaks: [
        { start: '10:30', end: '11:00' },
        { start: '12:00', end: '13:00' },
      ],
    });

    const res = await putSchedule(admin, doctor._id.toString(), { schedule: tuesday });

    expect(res.status).toBe(409);
  });

  it('saves a change that every booking still fits, and audits it', async () => {
    const { doctor, admin } = await setUp();
    const longerTuesday = withDay(2, {
      sessions: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
      breaks: [{ start: '12:00', end: '13:00' }],
    });

    const res = await putSchedule(admin, doctor._id.toString(), { schedule: longerTuesday });

    expect(res.status).toBe(200);
    const saved = await DoctorModel.findById(doctor._id).lean();
    expect(saved?.schedule.find((day) => day.dayOfWeek === 2)?.sessions[0]?.start).toBe('08:00');
    expect(saved?.scheduleVersion).toBe(1);
    expect(
      await AuditLogModel.countDocuments({ action: AUDIT_ACTIONS.UPDATE, entityId: doctor._id }),
    ).toBe(1);
  });

  it('ignores past, cancelled and completed appointments', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
    await createAppointment(doctor, { date: '2030-01-13', slotStart: '10:30', slotEnd: '10:45' });
    await createAppointment(doctor, {
      date: TUESDAY,
      status: APPOINTMENT_STATUS.CANCELLED,
      cancelledAt: new Date(),
    });
    await createAppointment(doctor, {
      date: TUESDAY,
      slotStart: '09:00',
      slotEnd: '09:15',
      status: APPOINTMENT_STATUS.COMPLETED,
      arrivedAt: new Date(),
      completedAt: new Date(),
    });
    const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));

    const res = await putSchedule(admin, doctor._id.toString(), { schedule: [] });

    expect(res.status).toBe(200);
  });

  it("counts an arrived patient and today's earlier appointments", async () => {
    const { doctor, admin } = await setUp({ date: TODAY, slotStart: '09:00', slotEnd: '09:15' });
    await createAppointment(doctor, {
      date: TUESDAY,
      slotStart: '11:00',
      slotEnd: '11:15',
      status: APPOINTMENT_STATUS.ARRIVED,
      arrivedAt: new Date(),
    });

    const res = await putSchedule(admin, doctor._id.toString(), { schedule: [] });

    expect(res.status).toBe(409);
    expect(
      strandedSchema.parse(bodyOf(res).meta.appointments).map((a) => `${a.date} ${a.slotStart}`),
    ).toEqual([`${TODAY} 09:00`, `${TUESDAY} 11:00`]);
  });
});
