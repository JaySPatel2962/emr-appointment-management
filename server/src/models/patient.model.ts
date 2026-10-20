import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

import { GENDERS, MOBILE_PATTERN } from '#app/constants/patient.js';
import { lowercaseCopy } from '#app/models/plugins/lowercase-copy.js';
import { nameWordsCopy } from '#app/models/plugins/name-words-copy.js';
import { DATE_PATTERN } from '#app/utils/time.js';

const patientSchema = new Schema(
  {
    // Human-readable id such as PAT-000001, numbered by an atomic counter.
    patientCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameLower: { type: String, required: true },
    // The name's words, lowercase with accents folded, for word-prefix search (see the plugin).
    nameWords: { type: [String], default: [] },
    // Normalized to 10 digits. Not unique: family members often share one phone number.
    mobile: { type: String, required: true, match: MOBILE_PATTERN },
    gender: { type: String, required: true, enum: Object.values(GENDERS) },
    dateOfBirth: { type: String, match: DATE_PATTERN },
  },
  { timestamps: true },
);

patientSchema.plugin(lowercaseCopy('name', 'nameLower'));
patientSchema.plugin(nameWordsCopy('name', 'nameWords'));

// Search by mobile number, exact or as a prefix while typing.
patientSchema.index({ mobile: 1 });
// Search by name: each word typed is an anchored prefix (/^rao/) on this multikey index.
patientSchema.index({ nameWords: 1 });
// The patient list, sorted by name with _id as the tie-breaker, read straight from the index.
patientSchema.index({ nameLower: 1, _id: 1 });

export type Patient = InferSchemaType<typeof patientSchema>;

export const PatientModel = model('Patient', patientSchema);
