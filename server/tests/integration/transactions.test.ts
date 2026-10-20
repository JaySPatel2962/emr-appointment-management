import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '#app/app.js';
import { CONFLICT_CODES } from '#app/constants/conflicts.js';
import { ROLES } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { DepartmentModel } from '#app/models/department.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { AppError } from '#app/utils/app-error.js';
import { CONCURRENT_UPDATE, runInTransaction } from '#app/utils/transaction.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createUser } from '../helpers/factories.js';
import { bodyOf } from '../helpers/http.js';

// A write conflict with a concurrent transaction is transient: the transaction can simply run
// again. The server runs it once more, and if it loses again answers 409 "try again", never a
// 500 with the driver's error.

const app = createApp();
const TUESDAY = '2030-01-15';
const NOW = new Date('2030-01-14T04:30:00Z'); // Monday 10:00 in the clinic

const writeConflict = () =>
  new mongoose.mongo.MongoServerError({
    message: 'Write conflict during plan execution',
    code: 112,
    codeName: 'WriteConflict',
    errorLabels: ['TransientTransactionError'],
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runInTransaction', () => {
  it('runs the transaction once more after a transient error, from a clean slate', async () => {
    let attempts = 0;

    const result = await runInTransaction(async (session) => {
      attempts += 1;
      await DepartmentModel.create([{ name: `Attempt ${String(attempts)}` }], { session });
      if (attempts === 1) {
        throw writeConflict();
      }
      return 'saved';
    });

    expect(result).toBe('saved');
    expect(attempts).toBe(2);
    // The first attempt's write was rolled back with it.
    expect(await DepartmentModel.countDocuments({ name: /^Attempt/ })).toBe(1);
    expect(await DepartmentModel.exists({ name: 'Attempt 2' })).not.toBeNull();
  });

  it('answers 409 "try again" when the second attempt loses too, and saves nothing', async () => {
    let attempts = 0;

    const run = runInTransaction(async (session) => {
      attempts += 1;
      await DepartmentModel.create([{ name: `Attempt ${String(attempts)}` }], { session });
      throw writeConflict();
    });

    await expect(run).rejects.toBeInstanceOf(AppError);
    await expect(run).rejects.toMatchObject({
      statusCode: 409,
      message: CONCURRENT_UPDATE,
      meta: { code: CONFLICT_CODES.CONCURRENT_UPDATE },
    });
    expect(attempts).toBe(2);
    expect(await DepartmentModel.countDocuments({ name: /^Attempt/ })).toBe(0);
  });

  it('does not retry any other error', async () => {
    let attempts = 0;

    await expect(
      runInTransaction(() => {
        attempts += 1;
        return Promise.reject(AppError.conflict('Slot already booked'));
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'Slot already booked' });
    expect(attempts).toBe(1);
  });
});

describe('POST /api/v1/appointments with a new patient, under write conflicts', () => {
  const book = async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));
    return request(app)
      .post('/api/v1/appointments')
      .set('Authorization', receptionist)
      .send({
        doctorId: doctor._id.toString(),
        date: TUESDAY,
        slotStart: '10:30',
        purpose: 'Follow-up',
        newPatient: { name: 'Ravi Kumar', mobile: '9123456780', gender: 'MALE' },
      });
  };

  it('books after one write conflict, with one patient and one appointment', async () => {
    vi.spyOn(AppointmentModel, 'create').mockRejectedValueOnce(writeConflict());

    const res = await book();

    expect(res.status).toBe(201);
    expect(await PatientModel.countDocuments({ name: 'Ravi Kumar' })).toBe(1);
    expect(await AppointmentModel.countDocuments({ patientName: 'Ravi Kumar' })).toBe(1);
  });

  it('answers 409 with a retry message after two, and leaves no patient behind', async () => {
    vi.spyOn(AppointmentModel, 'create')
      .mockRejectedValueOnce(writeConflict())
      .mockRejectedValueOnce(writeConflict());

    const res = await book();

    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe(CONCURRENT_UPDATE);
    expect(bodyOf(res).meta).toMatchObject({ code: CONFLICT_CODES.CONCURRENT_UPDATE });
    expect(await PatientModel.countDocuments({ name: 'Ravi Kumar' })).toBe(0);
  });
});
