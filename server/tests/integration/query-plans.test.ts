import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '#app/app.js';
import { ROLES } from '#app/constants/roles.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { listSort } from '#app/services/appointment.service.js';
import { APPOINTMENT_SORT_FIELDS } from '#app/validators/appointment.validators.js';

import { authorizationFor } from '../helpers/auth.js';
import { createAppointment, createDoctor, createUser } from '../helpers/factories.js';

// Manual QA (G-06, Q-06) found lists without a filter reading the whole collection and sorting
// it in memory. Every list sort now has an index that returns rows already in order.

const app = createApp();

/** Every stage of a query's winning plan, such as ["LIMIT", "FETCH", "IXSCAN"]. */
const planStages = async (query: { explain: (verbosity: string) => Promise<unknown> }) => {
  const explained = (await query.explain('queryPlanner')) as {
    queryPlanner: { winningPlan: Record<string, unknown> };
  };
  const stages: string[] = [];
  const walk = (stage: unknown): void => {
    if (typeof stage !== 'object' || stage === null) {
      return;
    }
    const node = stage as Record<string, unknown>;
    if (typeof node.stage === 'string') {
      stages.push(node.stage);
    }
    walk(node.queryPlan);
    walk(node.inputStage);
    if (Array.isArray(node.inputStages)) {
      node.inputStages.forEach(walk);
    }
  };
  walk(explained.queryPlanner.winningPlan);
  return stages;
};

const setUpData = async () => {
  const { doctor } = await createDoctor();
  for (let index = 0; index < 12; index += 1) {
    await createAppointment(doctor, {
      date: `2030-02-${String(10 + index).padStart(2, '0')}`,
      patientName: `Patient ${String(index)}`,
    });
  }
};

describe('list query plans', () => {
  it.each(
    APPOINTMENT_SORT_FIELDS.flatMap((field) => [[field, 'asc'] as const, [field, 'desc'] as const]),
  )(
    'reads the unfiltered appointment list sorted by %s %s from an index',
    async (sortBy, sortOrder) => {
      await setUpData();

      const stages = await planStages(
        AppointmentModel.find({}).sort(listSort(sortBy, sortOrder)).limit(20),
      );

      expect(stages).toContain('IXSCAN');
      expect(stages).not.toContain('COLLSCAN');
      expect(stages).not.toContain('SORT');
    },
  );

  it('reads the unfiltered patient and doctor lists from an index', async () => {
    await setUpData();

    const patients = await planStages(
      PatientModel.find({}).sort({ nameLower: 1, _id: 1 }).limit(20),
    );
    const doctors = await planStages(DoctorModel.find({}).sort({ name: 1 }).limit(20));

    for (const stages of [patients, doctors]) {
      expect(stages).not.toContain('COLLSCAN');
      expect(stages).not.toContain('SORT');
    }
  });

  it('takes the unfiltered total from the collection metadata, and counts filtered ones', async () => {
    await setUpData();
    const receptionist = authorizationFor(await createUser(ROLES.RECEPTIONIST));
    const estimate = vi.spyOn(AppointmentModel, 'estimatedDocumentCount');
    const count = vi.spyOn(AppointmentModel, 'countDocuments');

    const all = await request(app).get('/api/v1/appointments').set('Authorization', receptionist);
    expect(estimate).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
    expect((all.body as { meta: { total: number } }).meta.total).toBe(12);

    const filtered = await request(app)
      .get('/api/v1/appointments')
      .query({ dateFrom: '2030-02-10', dateTo: '2030-02-12' })
      .set('Authorization', receptionist);
    expect(count).toHaveBeenCalledTimes(1);
    expect((filtered.body as { meta: { total: number } }).meta.total).toBe(3);
    vi.restoreAllMocks();
  });
});
