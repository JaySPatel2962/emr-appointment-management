import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '#app/app.js';
import { AUDIT_ACTIONS } from '#app/constants/audit.js';
import { CONFLICT_CODES } from '#app/constants/conflicts.js';
import { ROLES } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { SCHEDULE_STALE } from '#app/services/doctor.service.js';
import { toObjectId } from '#app/utils/object-id.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createUser, FULL_WEEK_SCHEDULE } from '../helpers/factories.js';
import { bodyOf, dataOf } from '../helpers/http.js';

// Found in the manual retest (R2-01l, Q-08): two admins changed the same week from the same
// starting point, and the later save silently undid the earlier one. A save now carries the
// version it was based on, and an outdated one is refused.

const app = createApp();
const versionSchema = z.object({ scheduleVersion: z.number() });

const setUp = async () => {
  const { doctor } = await createDoctor({ slotDurationMinutes: 15 });
  const admin = authorizationFor(await createUser(ROLES.SUPER_ADMIN));
  return { id: doctor._id.toString(), admin };
};

const save = (admin: string, id: string, body: Record<string, unknown>) =>
  request(app)
    .put(`/api/v1/doctors/${id}/schedule`)
    .set('Authorization', admin)
    .send({ schedule: FULL_WEEK_SCHEDULE, ...body });

const versionOf = async (admin: string, id: string): Promise<number> =>
  dataOf(await request(app).get(`/api/v1/doctors/${id}`).set('Authorization', admin), versionSchema)
    .scheduleVersion;

describe('PUT /api/v1/doctors/:id/schedule: optimistic concurrency', () => {
  it('saves a change based on the current version, and moves the version on', async () => {
    const { id, admin } = await setUp();
    expect(await versionOf(admin, id)).toBe(0);

    const res = await save(admin, id, { slotDurationMinutes: 20, scheduleVersion: 0 });

    expect(res.status).toBe(200);
    expect(dataOf(res, versionSchema).scheduleVersion).toBe(1);
    expect(await versionOf(admin, id)).toBe(1);
  });

  it('refuses a change based on an older version, and keeps the newer schedule', async () => {
    const { id, admin } = await setUp();
    expect((await save(admin, id, { slotDurationMinutes: 20, scheduleVersion: 0 })).status).toBe(
      200,
    );

    const stale = await save(admin, id, { slotDurationMinutes: 30, scheduleVersion: 0 });

    expect(stale.status).toBe(409);
    expect(bodyOf(stale).message).toBe(SCHEDULE_STALE);
    expect(bodyOf(stale).meta).toMatchObject({
      code: CONFLICT_CODES.SCHEDULE_STALE,
      scheduleVersion: 1,
    });
    const saved = await DoctorModel.findById(id).lean();
    expect(saved?.slotDurationMinutes).toBe(20);
    expect(saved?.scheduleVersion).toBe(1);
    expect(await AuditLogModel.countDocuments({ action: AUDIT_ACTIONS.UPDATE, entityId: id })).toBe(
      1,
    );
  });

  it('lets exactly one of two saves of the same version through', async () => {
    const { id, admin } = await setUp();

    const [first, second] = await Promise.all([
      save(admin, id, { slotDurationMinutes: 20, scheduleVersion: 0 }),
      save(admin, id, { slotDurationMinutes: 30, scheduleVersion: 0 }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const [winner, loser] = first.status === 200 ? [first, second] : [second, first];
    expect(bodyOf(loser).meta).toMatchObject({ scheduleVersion: 1 });
    // The schedule is the winner's, whole: not a mix, and not the loser's.
    const saved = await DoctorModel.findById(id).lean();
    expect(saved?.scheduleVersion).toBe(1);
    expect(saved?.slotDurationMinutes).toBe(
      dataOf(winner, z.object({ slotDurationMinutes: z.number() })).slotDurationMinutes,
    );
  });

  it('needs the version', async () => {
    const { id, admin } = await setUp();

    const res = await save(admin, id, { slotDurationMinutes: 20 });

    expect(res.status).toBe(400);
    expect(bodyOf(res).meta.errors).toEqual([
      {
        field: 'body.scheduleVersion',
        message: 'Send the scheduleVersion of the schedule being changed',
      },
    ]);
  });

  it('reads a doctor saved before versions existed as version 0', async () => {
    const { id, admin } = await setUp();
    await DoctorModel.collection.updateOne(
      { _id: toObjectId(id) },
      { $unset: { scheduleVersion: '' } },
    );
    expect(await versionOf(admin, id)).toBe(0);

    const res = await save(admin, id, { scheduleVersion: 0 });

    expect(res.status).toBe(200);
    expect(dataOf(res, versionSchema).scheduleVersion).toBe(1);
  });
});
