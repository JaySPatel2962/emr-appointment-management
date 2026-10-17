import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { ROLES } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { toObjectId } from '#app/utils/object-id.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createPatient, createUser } from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

const app = createApp();
const URL = '/api/v1/appointments';
const SLOT = { date: '2030-01-15', slotStart: '13:30' };
const PARALLEL_REQUESTS = 10;

const idSchema = z.object({ id: z.string() });

/** A doctor, a receptionist, and one patient per parallel request. */
const setUp = async () => {
  const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
  const patients = await Promise.all(
    Array.from({ length: PARALLEL_REQUESTS }, (_, index) =>
      createPatient({ name: `Patient ${index + 1}` }),
    ),
  );
  return {
    doctorId: doctor._id.toString(),
    patientIds: patients.map((patient) => patient._id.toString()),
    authorization: authorizationFor(await createUser(ROLES.RECEPTIONIST)),
  };
};

type Setup = Awaited<ReturnType<typeof setUp>>;

const bookFor = ({ doctorId, authorization }: Setup, patientId: string) =>
  request(app)
    .post(URL)
    .set('Authorization', authorization)
    .send({ doctorId, ...SLOT, purpose: 'Follow-up', patientId });

const statusCounts = (responses: readonly { status: number }[]): Record<number, number> =>
  responses.reduce<Record<number, number>>(
    (counts, { status }) => ({ ...counts, [status]: (counts[status] ?? 0) + 1 }),
    {},
  );

const slotFilter = (doctorId: string) => ({ doctorId: toObjectId(doctorId), ...SLOT });

describe('booking one slot concurrently', () => {
  it(`lets exactly 1 of ${PARALLEL_REQUESTS} simultaneous bookings through; the rest get 409`, async () => {
    const setup = await setUp();

    const responses = await Promise.all(
      setup.patientIds.map((patientId) => bookFor(setup, patientId)),
    );

    expect(statusCounts(responses)).toEqual({ 201: 1, 409: PARALLEL_REQUESTS - 1 });
    expect(
      responses
        .filter((res) => res.status === 409)
        .every((res) => bodyOf(res).message === 'Slot already booked'),
    ).toBe(true);
    expect(await AppointmentModel.countDocuments(slotFilter(setup.doctorId))).toBe(1);
  });

  it('keeps exactly one new patient when new-patient bookings race for a slot', async () => {
    const { doctorId, authorization } = await setUp();
    const attempts = 5;

    const responses = await Promise.all(
      Array.from({ length: attempts }, (_, index) =>
        request(app)
          .post(URL)
          .set('Authorization', authorization)
          .send({
            doctorId,
            ...SLOT,
            purpose: 'First visit',
            newPatient: { name: `Walk-in ${index + 1}`, mobile: '9876543210', gender: 'FEMALE' },
          }),
      ),
    );

    expect(statusCounts(responses)).toEqual({ 201: 1, 409: attempts - 1 });
    // The losing transactions rolled back, so only the winner's patient record exists.
    expect(await PatientModel.countDocuments({ name: /^Walk-in/ })).toBe(1);
  });

  it('lets a cancelled slot be booked again, still by exactly one of many', async () => {
    const setup = await setUp();
    const [firstPatient = '', ...others] = setup.patientIds;
    const { id } = dataOf(await bookFor(setup, firstPatient), idSchema);
    const cancel = await request(app)
      .delete(`${URL}/${id}`)
      .set('Authorization', setup.authorization);

    const rebookings = await Promise.all(others.map((patientId) => bookFor(setup, patientId)));

    expect(cancel.status).toBe(200);
    expect(statusCounts(rebookings)).toEqual({ 201: 1, 409: others.length - 1 });
    expect(
      await AppointmentModel.countDocuments({
        ...slotFilter(setup.doctorId),
        status: APPOINTMENT_STATUS.CANCELLED,
      }),
    ).toBe(1);
    expect(
      await AppointmentModel.countDocuments({
        ...slotFilter(setup.doctorId),
        status: APPOINTMENT_STATUS.SCHEDULED,
      }),
    ).toBe(1);
  });
});

describe('changing one appointment concurrently', () => {
  it('lets only one of two simultaneous cancellations succeed', async () => {
    const setup = await setUp();
    const { id } = dataOf(await bookFor(setup, setup.patientIds[0] ?? ''), idSchema);
    const cancel = () =>
      request(app).delete(`${URL}/${id}`).set('Authorization', setup.authorization);

    const [first, second] = await Promise.all([cancel(), cancel()]);

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([200, 409]);
  });
});
