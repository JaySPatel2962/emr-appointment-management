import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';

import { authorizationFor } from '../helpers/auth.js';
import { createAppointment, createDoctor } from '../helpers/factories.js';
import { dataOf } from '../helpers/http.js';

const app = createApp();

describe('doctor scoping', () => {
  it("keeps a doctor out of every other doctor's data, while their own stays reachable", async () => {
    const { user, doctor } = await createDoctor({ slotDurationMinutes: 30 });
    const { doctor: other } = await createDoctor({ slotDurationMinutes: 30 });
    const own = await createAppointment(doctor, { patientName: 'Own Patient' });
    const foreign = await createAppointment(other, { patientName: 'Foreign Patient' });
    const authorization = authorizationFor(user, doctor._id);
    const otherId = other._id.toString();
    const foreignPath = `/api/v1/appointments/${foreign._id.toString()}`;
    const get = (path: string) => request(app).get(path).set('Authorization', authorization);

    const doctors = await get('/api/v1/doctors');
    const appointments = await get(`/api/v1/appointments?doctorId=${otherId}`);

    expect(dataOf(doctors, z.array(z.object({ id: z.string() }))).map((d) => d.id)).toEqual([
      doctor._id.toString(),
    ]);
    expect((await get(`/api/v1/doctors/${otherId}`)).status).toBe(404);
    expect((await get(`/api/v1/slots?doctorId=${otherId}&date=2030-01-15`)).status).toBe(403);
    expect(
      dataOf(appointments, z.array(z.object({ patient: z.object({ name: z.string() }) }))).map(
        (appointment) => appointment.patient.name,
      ),
    ).toEqual(['Own Patient']);
    expect((await get(foreignPath)).status).toBe(404);
    expect(
      (
        await request(app)
          .put(foreignPath)
          .set('Authorization', authorization)
          .send({ notes: 'Not mine' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).post(`${foreignPath}/complete`).set('Authorization', authorization))
        .status,
    ).toBe(404);
    expect((await get(`/api/v1/appointments/${own._id.toString()}`)).status).toBe(200);
  });
});
