import { model, Schema } from 'mongoose';

const counterSchema = new Schema(
  {
    // The sequence name, e.g. "patientCode".
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = model('Counter', counterSchema);
