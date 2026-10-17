import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);

// Unique regardless of case: "Cardiology" and "cardiology" can't both exist.
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export type Department = InferSchemaType<typeof departmentSchema>;

export const DepartmentModel = model('Department', departmentSchema);
