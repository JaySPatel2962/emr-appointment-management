import { CounterModel } from '#app/models/counter.model.js';

/**
 * Atomically increments a named sequence and returns the new value. A single findOneAndUpdate
 * with $inc means concurrent callers always get distinct numbers; upsert creates the sequence
 * on first use.
 */
export const nextSequence = async (name: string): Promise<number> => {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  return counter.seq;
};
