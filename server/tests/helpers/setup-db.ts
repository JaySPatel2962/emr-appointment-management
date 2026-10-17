import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

// Each test file gets its own database on the shared replica set, so files can
// run in parallel without seeing each other's data.
beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `emr_test_${randomUUID()}` });
});

// Empty the collections between tests but keep them (and their indexes, such as
// the double-booking unique index) in place.
afterEach(async () => {
  const collections = (await mongoose.connection.db?.collections()) ?? [];
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
