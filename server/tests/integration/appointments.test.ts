import type { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { PatientModel } from '#app/models/patient.model.js';

import { authorizationFor } from '../helpers/auth.js';
import {
  createAppointment,
  createDepartment,
  createDoctor,
  createPatient,
  createUser,
} from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

const app = createApp();
const URL = '/api/v1/appointments';
const TODAY = '2030-01-15'; // a Tuesday
const TOMORROW = '2030-01-16';
// 10:07 in the clinic (Asia/Kolkata is UTC+5:30).
const NOW = new Date('2030-01-15T04:37:00Z');
const UNKNOWN_ID = '665f1a2b3c4d5e6f7a8b9c0d';

const appointmentSchema = z.object({
  id: z.string(),
  patient: z.object({
    id: z.string(),
    patientCode: z.string(),
    name: z.string(),
    mobile: z.string(),
  }),
  doctor: z.object({ id: z.string(), name: z.string() }),
  departmentId: z.string(),
  date: z.string(),
  slotStart: z.string(),
  slotEnd: z.string(),
  purpose: z.string(),
  notes: z.string(),
  status: z.string(),
  arrivedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
});
const appointmentListSchema = z.array(appointmentSchema);

beforeEach(() => {
  // Only Date is faked, so MongoDB's own timers keep running.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** A doctor working 09:00-12:00 and 13:00-17:00 in 30-minute slots, a patient, and staff. */
const setUpClinic = async () => {
  const { user: doctorUser, doctor } = await createDoctor({
    name: 'Dr. Kavya Mehta',
    slotDurationMinutes: 30,
  });
  return {
    doctor,
    patient: await createPatient(),
    admin: authorizationFor(await createUser(ROLES.SUPER_ADMIN)),
    receptionist: authorizationFor(await createUser(ROLES.RECEPTIONIST)),
    doctorAuth: authorizationFor(doctorUser, doctor._id),
  };
};

type Clinic = Awaited<ReturnType<typeof setUpClinic>>;

const booking = (doctorId: Types.ObjectId, extra: Record<string, unknown>) => ({
  doctorId: doctorId.toString(),
  date: TODAY,
  slotStart: '13:30',
  purpose: 'Follow-up',
  ...extra,
});

const book = (authorization: string, body: Record<string, unknown>) =>
  request(app).post(URL).set('Authorization', authorization).send(body);

/** Books 13:30 today for the clinic's patient and returns the appointment's id. */
const bookOne = async (clinic: Clinic): Promise<string> => {
  const res = await book(
    clinic.receptionist,
    booking(clinic.doctor._id, { patientId: clinic.patient._id.toString() }),
  );
  return dataOf(res, appointmentSchema).id;
};

const newPatient = { name: 'Ravi Kumar', mobile: '+91 98765-43211', gender: 'MALE' };

describe('POST /api/v1/appointments', () => {
  it('books a slot for an existing patient and audits it', async () => {
    const clinic = await setUpClinic();

    const res = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, {
        patientId: clinic.patient._id.toString(),
        notes: 'First visit',
      }),
    );

    expect(res.status).toBe(201);
    expect(dataOf(res, appointmentSchema)).toMatchObject({
      patient: { id: clinic.patient._id.toString(), name: 'Asha Rao', mobile: '9876543210' },
      doctor: { id: clinic.doctor._id.toString(), name: 'Dr. Kavya Mehta' },
      departmentId: clinic.doctor.departmentId.toString(),
      date: TODAY,
      slotStart: '13:30',
      slotEnd: '14:00',
      notes: 'First visit',
      status: APPOINTMENT_STATUS.SCHEDULED,
    });
    expect(
      await AuditLogModel.countDocuments({
        action: AUDIT_ACTIONS.CREATE,
        entity: AUDIT_ENTITIES.APPOINTMENT,
      }),
    ).toBe(1);
  });

  it('registers a new patient and books the slot in one request', async () => {
    const clinic = await setUpClinic();

    const res = await book(clinic.receptionist, booking(clinic.doctor._id, { newPatient }));

    expect(res.status).toBe(201);
    expect(dataOf(res, appointmentSchema).patient).toMatchObject({
      patientCode: 'PAT-000001',
      name: 'Ravi Kumar',
      mobile: '9876543211',
    });
    expect(await PatientModel.countDocuments({ name: 'Ravi Kumar' })).toBe(1);
    expect(
      await AuditLogModel.countDocuments({
        action: AUDIT_ACTIONS.CREATE,
        entity: AUDIT_ENTITIES.PATIENT,
      }),
    ).toBe(1);
  });

  it('needs exactly one of patientId and newPatient', async () => {
    const clinic = await setUpClinic();
    const patientId = clinic.patient._id.toString();

    const both = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, { patientId, newPatient }),
    );
    const neither = await book(clinic.receptionist, booking(clinic.doctor._id, {}));

    expect(both.status).toBe(400);
    expect(neither.status).toBe(400);
  });

  it.each([
    ['during lunch', { slotStart: '12:30' }],
    ['off the slot grid', { slotStart: '13:10' }],
    ['that has already started', { slotStart: '10:00' }],
    ['on a past date', { date: '2030-01-14' }],
  ])('rejects a time %s with 422', async (_label, override) => {
    const clinic = await setUpClinic();

    const res = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, { patientId: clinic.patient._id.toString(), ...override }),
    );

    expect(res.status).toBe(422);
  });

  it('answers 409 when the slot is taken, and keeps no half-registered patient', async () => {
    const clinic = await setUpClinic();
    await bookOne(clinic);

    const res = await book(clinic.receptionist, booking(clinic.doctor._id, { newPatient }));

    expect(res.status).toBe(409);
    expect(bodyOf(res).message).toBe('Slot already booked');
    expect(await PatientModel.countDocuments({ name: 'Ravi Kumar' })).toBe(0);
  });

  it('returns 404 for an unknown doctor or patient', async () => {
    const clinic = await setUpClinic();

    const unknownDoctor = await book(clinic.receptionist, {
      ...booking(clinic.doctor._id, { patientId: clinic.patient._id.toString() }),
      doctorId: UNKNOWN_ID,
    });
    const unknownPatient = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, { patientId: UNKNOWN_ID }),
    );

    expect(unknownDoctor.status).toBe(404);
    expect(unknownPatient.status).toBe(404);
  });

  it("rejects a department that isn't the doctor's", async () => {
    const clinic = await setUpClinic();
    const otherDepartment = await createDepartment();

    const res = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, {
        patientId: clinic.patient._id.toString(),
        departmentId: otherDepartment._id.toString(),
      }),
    );

    expect(res.status).toBe(422);
  });

  it('is for front-desk staff only', async () => {
    const clinic = await setUpClinic();

    const res = await book(
      clinic.doctorAuth,
      booking(clinic.doctor._id, { patientId: clinic.patient._id.toString() }),
    );

    expect(res.status).toBe(403);
  });
});

describe('the status workflow', () => {
  it('goes from scheduled to arrived to completed, and audits each step', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const arrived = await request(app)
      .post(`${URL}/${id}/arrive`)
      .set('Authorization', clinic.receptionist);
    const completed = await request(app)
      .post(`${URL}/${id}/complete`)
      .set('Authorization', clinic.doctorAuth);

    expect(dataOf(arrived, appointmentSchema)).toMatchObject({
      status: APPOINTMENT_STATUS.ARRIVED,
      arrivedAt: NOW.toISOString(),
    });
    expect(dataOf(completed, appointmentSchema)).toMatchObject({
      status: APPOINTMENT_STATUS.COMPLETED,
      completedAt: NOW.toISOString(),
    });
    expect(
      await AuditLogModel.countDocuments({
        entity: AUDIT_ENTITIES.APPOINTMENT,
        action: { $in: [AUDIT_ACTIONS.ARRIVE, AUDIT_ACTIONS.COMPLETE] },
      }),
    ).toBe(2);
  });

  it('refuses moves the workflow does not allow', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const completeTooEarly = await request(app)
      .post(`${URL}/${id}/complete`)
      .set('Authorization', clinic.admin);
    const cancelled = await request(app).delete(`${URL}/${id}`).set('Authorization', clinic.admin);
    const arriveAfterCancel = await request(app)
      .post(`${URL}/${id}/arrive`)
      .set('Authorization', clinic.receptionist);
    const cancelAgain = await request(app)
      .delete(`${URL}/${id}`)
      .set('Authorization', clinic.receptionist);

    expect(completeTooEarly.status).toBe(409);
    expect(bodyOf(completeTooEarly).message).toBe(
      'This appointment is scheduled and cannot be completed',
    );
    expect(dataOf(cancelled, appointmentSchema)).toMatchObject({
      status: APPOINTMENT_STATUS.CANCELLED,
      cancelledAt: NOW.toISOString(),
    });
    expect(arriveAfterCancel.status).toBe(409);
    expect(cancelAgain.status).toBe(409);
  });

  it('lets a cancelled slot be booked again', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);
    await request(app).delete(`${URL}/${id}`).set('Authorization', clinic.receptionist);

    const rebooked = await book(
      clinic.receptionist,
      booking(clinic.doctor._id, { patientId: clinic.patient._id.toString() }),
    );

    expect(rebooked.status).toBe(201);
  });

  it('applies the role rules to each step', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const doctorArrives = await request(app)
      .post(`${URL}/${id}/arrive`)
      .set('Authorization', clinic.doctorAuth);
    const receptionistCompletes = await request(app)
      .post(`${URL}/${id}/complete`)
      .set('Authorization', clinic.receptionist);
    const doctorCancels = await request(app)
      .delete(`${URL}/${id}`)
      .set('Authorization', clinic.doctorAuth);

    expect(doctorArrives.status).toBe(403);
    expect(receptionistCompletes.status).toBe(403);
    expect(doctorCancels.status).toBe(403);
  });

  it('returns 404 for an unknown appointment', async () => {
    const clinic = await setUpClinic();

    const res = await request(app)
      .post(`${URL}/${UNKNOWN_ID}/arrive`)
      .set('Authorization', clinic.receptionist);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/appointments/:id', () => {
  it('lets the front desk change purpose and notes, auditing only the field names', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const res = await request(app)
      .put(`${URL}/${id}`)
      .set('Authorization', clinic.receptionist)
      .send({ purpose: 'Chest pain', notes: 'Bring old reports' });

    expect(dataOf(res, appointmentSchema)).toMatchObject({
      purpose: 'Chest pain',
      notes: 'Bring old reports',
    });
    const audit = await AuditLogModel.findOne({ action: AUDIT_ACTIONS.UPDATE }).lean();
    expect(audit?.metadata).toEqual({ fields: ['purpose', 'notes'] });
  });

  it('lets a doctor write consultation notes but not change the purpose', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const notes = await request(app)
      .put(`${URL}/${id}`)
      .set('Authorization', clinic.doctorAuth)
      .send({ notes: 'BP 130/85' });
    const purpose = await request(app)
      .put(`${URL}/${id}`)
      .set('Authorization', clinic.doctorAuth)
      .send({ purpose: 'Something else' });

    expect(notes.status).toBe(200);
    expect(purpose.status).toBe(403);
  });

  it('keeps notes editable after the visit, and freezes a cancelled appointment', async () => {
    const clinic = await setUpClinic();
    const completedId = await bookOne(clinic);
    await request(app)
      .post(`${URL}/${completedId}/arrive`)
      .set('Authorization', clinic.receptionist);
    await request(app).post(`${URL}/${completedId}/complete`).set('Authorization', clinic.admin);
    const cancelled = await createAppointment(clinic.doctor, {
      date: TOMORROW,
      slotStart: '09:00',
      slotEnd: '09:30',
      status: APPOINTMENT_STATUS.CANCELLED,
    });

    const notesAfterVisit = await request(app)
      .put(`${URL}/${completedId}`)
      .set('Authorization', clinic.doctorAuth)
      .send({ notes: 'Review in two weeks' });
    const purposeAfterVisit = await request(app)
      .put(`${URL}/${completedId}`)
      .set('Authorization', clinic.receptionist)
      .send({ purpose: 'Something else' });
    const notesWhenCancelled = await request(app)
      .put(`${URL}/${cancelled._id.toString()}`)
      .set('Authorization', clinic.receptionist)
      .send({ notes: 'Too late' });

    expect(notesAfterVisit.status).toBe(200);
    expect(purposeAfterVisit.status).toBe(409);
    expect(notesWhenCancelled.status).toBe(409);
  });

  it('needs at least one field', async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const res = await request(app)
      .put(`${URL}/${id}`)
      .set('Authorization', clinic.receptionist)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/appointments', () => {
  /** Three appointments across two doctors in two departments. */
  const setUpList = async () => {
    const cardiology = await createDepartment('Cardiology');
    const dermatology = await createDepartment('Dermatology');
    const { user: mehtaUser, doctor: mehta } = await createDoctor({
      departmentId: cardiology._id,
      name: 'Dr. Kavya Mehta',
    });
    const { doctor: iyer } = await createDoctor({
      departmentId: dermatology._id,
      name: 'Dr. Arjun Iyer',
    });
    await createAppointment(mehta, {
      date: TOMORROW,
      slotStart: '09:00',
      slotEnd: '09:15',
      patientName: 'Asha Rao',
      patientMobile: '9876543210',
    });
    await createAppointment(mehta, {
      date: '2030-01-17',
      slotStart: '10:00',
      slotEnd: '10:15',
      patientName: 'Bhavna Shah',
      patientMobile: '9123456780',
      status: APPOINTMENT_STATUS.CANCELLED,
    });
    await createAppointment(iyer, {
      date: TOMORROW,
      slotStart: '11:00',
      slotEnd: '11:15',
      patientName: 'Asha Iyer',
      patientMobile: '9988776655',
      status: APPOINTMENT_STATUS.ARRIVED,
    });
    return {
      iyer,
      dermatology,
      mehtaAuth: authorizationFor(mehtaUser, mehta._id),
      receptionist: authorizationFor(await createUser(ROLES.RECEPTIONIST)),
    };
  };

  const patientNames = async (
    authorization: string,
    query: Record<string, string | number>,
  ): Promise<string[]> => {
    const res = await request(app).get(URL).query(query).set('Authorization', authorization);
    return dataOf(res, appointmentListSchema).map((appointment) => appointment.patient.name);
  };

  it('filters on the server by patient, mobile, status, department, dates and doctor', async () => {
    const list = await setUpList();
    const auth = list.receptionist;

    expect(await patientNames(auth, { patientName: 'asha' })).toEqual(['Asha Rao', 'Asha Iyer']);
    // Any word of the name, in any order (manual QA, Q-03).
    expect(await patientNames(auth, { patientName: 'iyer' })).toEqual(['Asha Iyer']);
    expect(await patientNames(auth, { patientName: 'rao asha' })).toEqual(['Asha Rao']);
    expect(await patientNames(auth, { patientName: '--' })).toEqual([]);
    expect(await patientNames(auth, { mobile: '+91 98765' })).toEqual(['Asha Rao']);
    expect(await patientNames(auth, { status: 'CANCELLED' })).toEqual(['Bhavna Shah']);
    expect(await patientNames(auth, { departmentId: list.dermatology._id.toString() })).toEqual([
      'Asha Iyer',
    ]);
    expect(await patientNames(auth, { dateFrom: '2030-01-17', dateTo: '2030-01-17' })).toEqual([
      'Bhavna Shah',
    ]);
    expect(await patientNames(auth, { doctorName: 'iyer' })).toEqual(['Asha Iyer']);
  });

  it('refuses a mobile filter without a digit instead of matching every appointment', async () => {
    const list = await setUpList();

    const res = await request(app)
      .get(URL)
      .query({ mobile: '--' })
      .set('Authorization', list.receptionist);

    expect(res.status).toBe(400);
    expect(bodyOf(res).meta.errors).toEqual([
      { field: 'query.mobile', message: 'Must contain a digit' },
    ]);
  });

  it('sorts by whitelisted fields only, and paginates', async () => {
    const list = await setUpList();

    const sorted = await patientNames(list.receptionist, {
      sortBy: 'patientName',
      sortOrder: 'desc',
    });
    const secondPage = await request(app)
      .get(URL)
      .query({ limit: 2, page: 2 })
      .set('Authorization', list.receptionist);
    const unknownSort = await request(app)
      .get(URL)
      .query({ sortBy: 'passwordHash' })
      .set('Authorization', list.receptionist);

    expect(sorted).toEqual(['Bhavna Shah', 'Asha Rao', 'Asha Iyer']);
    expect(dataOf(secondPage, appointmentListSchema)).toHaveLength(1);
    expect(bodyOf(secondPage).meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(unknownSort.status).toBe(400);
  });

  it('shows a doctor only their own appointments, whatever the filters say', async () => {
    const list = await setUpList();

    expect(await patientNames(list.mehtaAuth, {})).toEqual(['Asha Rao', 'Bhavna Shah']);
    expect(await patientNames(list.mehtaAuth, { doctorId: list.iyer._id.toString() })).toEqual([
      'Asha Rao',
      'Bhavna Shah',
    ]);
  });
});

describe('GET /api/v1/appointments/:id', () => {
  it("includes the patient's details", async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);

    const res = await request(app).get(`${URL}/${id}`).set('Authorization', clinic.doctorAuth);

    const detail = dataOf(
      res,
      z.object({ patient: z.object({ patientCode: z.string(), gender: z.string() }) }),
    );
    expect(detail.patient).toEqual({ patientCode: clinic.patient.patientCode, gender: 'FEMALE' });
  });

  it("answers 404 to a doctor asking for another doctor's appointment", async () => {
    const clinic = await setUpClinic();
    const id = await bookOne(clinic);
    const { user, doctor } = await createDoctor();

    const res = await request(app)
      .get(`${URL}/${id}`)
      .set('Authorization', authorizationFor(user, doctor._id));

    expect(res.status).toBe(404);
  });
});
