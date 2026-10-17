import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';

import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { ROLES } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import type { Appointment } from '#app/models/appointment.model.js';
import { DepartmentModel } from '#app/models/department.model.js';
import { RefreshTokenModel } from '#app/models/refresh-token.model.js';
import { UserModel } from '#app/models/user.model.js';
import { nextSequence } from '#app/services/counter.service.js';
import { isDuplicateKeyError } from '#app/utils/mongo-errors.js';

const { ObjectId } = mongoose.Types;
const doctorId = new ObjectId();

const appointment = (overrides: Partial<Appointment> = {}) => ({
  patientId: new ObjectId(),
  doctorId,
  departmentId: new ObjectId(),
  date: '2030-01-15',
  slotStart: '09:00',
  slotEnd: '09:15',
  purpose: 'Follow-up',
  createdBy: new ObjectId(),
  patientCode: 'PAT-000001',
  patientName: 'Asha Rao',
  patientMobile: '9876543210',
  doctorName: 'Dr. Kavya Mehta',
  ...overrides,
});

beforeAll(async () => {
  // Indexes build in the background once connected; wait for them before relying on them.
  await Promise.all([
    AppointmentModel.init(),
    UserModel.init(),
    DepartmentModel.init(),
    RefreshTokenModel.init(),
  ]);
});

describe('appointment double-booking index', () => {
  it('rejects a second active appointment for the same doctor, date and start time', async () => {
    await AppointmentModel.create(appointment());

    await expect(AppointmentModel.create(appointment())).rejects.toSatisfy(isDuplicateKeyError);
  });

  it('lets exactly one of ten concurrent bookings for a slot succeed', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => AppointmentModel.create(appointment())),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      results.filter(
        (result) => result.status === 'rejected' && isDuplicateKeyError(result.reason),
      ),
    ).toHaveLength(9);
  });

  it('frees the slot when the appointment is cancelled', async () => {
    const first = await AppointmentModel.create(appointment());
    await AppointmentModel.updateOne(
      { _id: first._id },
      { status: APPOINTMENT_STATUS.CANCELLED, cancelledAt: new Date() },
    );

    await expect(AppointmentModel.create(appointment())).resolves.toBeDefined();
    // Any number of cancelled appointments may share the slot.
    await expect(
      AppointmentModel.create(appointment({ status: APPOINTMENT_STATUS.CANCELLED })),
    ).resolves.toBeDefined();
  });

  it('allows the same start time for another doctor or on another date', async () => {
    await AppointmentModel.create(appointment());

    await expect(
      AppointmentModel.create(appointment({ doctorId: new ObjectId() })),
    ).resolves.toBeDefined();
    await expect(
      AppointmentModel.create(appointment({ date: '2030-01-16' })),
    ).resolves.toBeDefined();
  });
});

describe('unique logins and departments', () => {
  it('treats emails case-insensitively and hides password hashes by default', async () => {
    const user = { name: 'Asha Rao', passwordHash: 'hash', role: ROLES.RECEPTIONIST };
    await UserModel.create({ ...user, email: 'Asha@Clinic.in' });

    await expect(UserModel.create({ ...user, email: 'asha@clinic.in' })).rejects.toSatisfy(
      isDuplicateKeyError,
    );

    const found = await UserModel.findOne({ email: 'asha@clinic.in' }).lean();
    expect(found).not.toHaveProperty('passwordHash');
    const withHash = await UserModel.findOne({ email: 'asha@clinic.in' })
      .select('+passwordHash')
      .lean();
    expect(withHash?.passwordHash).toBe('hash');
  });

  it('rejects department names that differ only in case', async () => {
    await DepartmentModel.create({ name: 'Cardiology' });

    await expect(DepartmentModel.create({ name: 'cardiology' })).rejects.toSatisfy(
      isDuplicateKeyError,
    );
  });
});

describe('patient code counter', () => {
  it('hands out distinct, consecutive numbers under concurrency', async () => {
    const values = await Promise.all(
      Array.from({ length: 25 }, () => nextSequence('test-sequence')),
    );

    expect([...values].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });
});

describe('refresh token expiry', () => {
  it('has a TTL index, so MongoDB deletes expired tokens', async () => {
    const indexes: unknown[] = await RefreshTokenModel.listIndexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
  });
});
