import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import * as scheduleFit from '#app/services/schedule-fit.service.js';
import { SCHEDULE_CHANGED_WHILE_BOOKING } from '#app/services/appointment.service.js';
import * as slotService from '#app/services/slot.service.js';

import { authorizationFor } from '../helpers/auth.js';
import {
  createAppointment,
  createDoctor,
  createUser,
  FULL_WEEK_SCHEDULE,
} from '../helpers/factories.js';
import { bodyOf } from '../helpers/http.js';

// A booking and a schedule change made at the same moment: each was checked against what the
// other hadn't saved yet. These tests replay those orders by letting the first check see the
// state from before the other request.

vi.mock('#app/services/schedule-fit.service.js', async (importOriginal) => {
  const original = await importOriginal<typeof scheduleFit>();
  return { ...original, findStrandedAppointments: vi.fn(original.findStrandedAppointments) };
});
vi.mock('#app/services/slot.service.js', async (importOriginal) => {
  const original = await importOriginal<typeof slotService>();
  return { ...original, findSchedulingDoctor: vi.fn(original.findSchedulingDoctor) };
});

const app = createApp();
const TUESDAY = '2030-01-15';
const NOW = new Date('2030-01-14T04:30:00Z'); // Monday 10:00 in the clinic

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a booking and a schedule change at the same moment', () => {
  it('undoes the schedule change when a booking it missed would be stranded', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
    const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));
    // The booking lands after the change's first check: that check saw no appointment.
    await createAppointment(doctor, { date: TUESDAY, slotStart: '10:30', slotEnd: '10:45' });
    vi.mocked(scheduleFit.findStrandedAppointments).mockResolvedValueOnce([]);

    const res = await request(app)
      .put(`/api/v1/doctors/${doctor._id.toString()}/schedule`)
      .set('Authorization', admin)
      .send({ schedule: FULL_WEEK_SCHEDULE, slotDurationMinutes: 20, scheduleVersion: 0 });

    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe(
      'A booking was made for a time this change removes while it was being saved. Nothing was changed; check it, then try again.',
    );
    expect(bodyOf(res).meta).toMatchObject({ code: 'APPOINTMENTS_STRANDED' });
    const saved = await DoctorModel.findById(doctor._id).lean();
    expect(saved?.slotDurationMinutes).toBe(15);
    expect(saved?.scheduleVersion).toBe(2); // saved once, then put back
  });

  it('undoes a booking whose slot a schedule change removed meanwhile', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));
    // The booking read the doctor before the change below was saved.
    const before = await slotService.findSchedulingDoctor(doctor._id.toString());
    vi.mocked(slotService.findSchedulingDoctor).mockResolvedValueOnce(before);
    await DoctorModel.updateOne({ _id: doctor._id }, { $set: { slotDurationMinutes: 20 } });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', receptionist)
      .send({
        doctorId: doctor._id.toString(),
        date: TUESDAY,
        slotStart: '10:30',
        purpose: 'Follow-up',
        newPatient: { name: 'Ravi Kumar', mobile: '9123456780', gender: 'MALE' },
      });

    // A clean conflict with a retry message, not a 500 and not the 422 for a slot never offered.
    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe(SCHEDULE_CHANGED_WHILE_BOOKING);
    expect(bodyOf(res).meta).toMatchObject({ code: 'SCHEDULE_CHANGED' });
    expect(await AppointmentModel.countDocuments({ doctorId: doctor._id })).toBe(0);
    expect(await PatientModel.countDocuments({ name: 'Ravi Kumar' })).toBe(0);
  });
});
