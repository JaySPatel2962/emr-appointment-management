import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs on an in-memory replica set that supports transactions', async () => {
    const probes = mongoose.connection.collection('harness_probes');

    await mongoose.connection.transaction(async (session) => {
      await probes.insertOne({ ok: true }, { session });
    });

    expect(await probes.countDocuments()).toBe(1);
  });
});
