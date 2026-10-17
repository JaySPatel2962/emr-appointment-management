import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { GENDERS } from '#app/constants/patient.js';
import { ROLES } from '#app/constants/roles.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { UserModel } from '#app/models/user.model.js';

describe('UserModel', () => {
  it('never serializes the password hash', () => {
    const user = new UserModel({
      name: 'Asha Rao',
      email: 'Asha@Clinic.in',
      passwordHash: 'bcrypt-hash',
      role: ROLES.RECEPTIONIST,
    });

    const json = user.toJSON();

    expect(json).not.toHaveProperty('passwordHash');
    expect(json).toMatchObject({ email: 'asha@clinic.in', role: ROLES.RECEPTIONIST });
  });
});

describe('DoctorModel', () => {
  it('rejects an invalid schedule with a readable message', async () => {
    const doctor = new DoctorModel({
      userId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      name: 'Dr. Kavya Mehta',
      specialization: 'Cardiology',
      slotDurationMinutes: 15,
      schedule: [{ dayOfWeek: 1, sessions: [{ start: '12:00', end: '09:00' }], breaks: [] }],
    });

    await expect(doctor.validate()).rejects.toMatchObject({
      errors: { schedule: { message: 'Start 12:00 must be before end 09:00' } },
    });
  });
});

describe('PatientModel', () => {
  it('keeps a lowercase copy of the name for prefix search', async () => {
    const patient = new PatientModel({
      patientCode: 'PAT-000001',
      name: 'Asha Rao',
      mobile: '9876543210',
      gender: GENDERS.FEMALE,
    });

    await patient.validate();

    expect(patient.nameLower).toBe('asha rao');
  });

  it('rejects a mobile number that is not a 10-digit Indian number', async () => {
    const patient = new PatientModel({
      patientCode: 'PAT-000002',
      name: 'Ravi Kumar',
      mobile: '12345',
      gender: GENDERS.MALE,
    });

    await expect(patient.validate()).rejects.toHaveProperty('errors.mobile.kind', 'regexp');
  });
});
