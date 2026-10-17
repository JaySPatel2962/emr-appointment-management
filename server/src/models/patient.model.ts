import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

import { GENDERS, MOBILE_PATTERN } from '#app/constants/patient.js';
import { lowercaseCopy } from '#app/models/plugins/lowercase-copy.js';
import { DATE_PATTERN } from '#app/utils/time.js';

const patientSchema = new Schema(
  {
    // Human-readable id such as PAT-000001, numbered by an atomic counter.
    patientCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameLower: { type: String, required: true },
    // Normalized to 10 digits. Not unique: family members often share one phone number.
    mobile: { type: String, required: true, match: MOBILE_PATTERN },
    gender: { type: String, required: true, enum: Object.values(GENDERS) },
    dateOfBirth: { type: String, match: DATE_PATTERN },
  },
  { timestamps: true },
);

patientSchema.plugin(lowercaseCopy('name', 'nameLower'));

// Search by mobile number, exact or as a prefix while typing.
patientSchema.index({ mobile: 1 });
// Search by name: an anchored prefix such as /^asha/ on the lowercase copy uses this index.
// A text index wouldn't do: it matches whole words only, never prefixes.
patientSchema.index({ nameLower: 1 });

export type Patient = InferSchemaType<typeof patientSchema>;

export const PatientModel = model('Patient', patientSchema);
