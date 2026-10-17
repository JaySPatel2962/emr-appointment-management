import type { ClientSession, QueryFilter, Types } from 'mongoose';

import { PATIENT_CODE_COUNTER } from '#app/constants/patient.js';
import type { Gender } from '#app/constants/patient.js';
import { PatientModel } from '#app/models/patient.model.js';
import type { Patient } from '#app/models/patient.model.js';
import { nextSequence } from '#app/services/counter.service.js';
import { mobileSearchPrefix } from '#app/utils/mobile.js';
import { pageSkip, toPage } from '#app/utils/pagination.js';
import type { Page } from '#app/utils/pagination.js';
import { formatPatientCode } from '#app/utils/patient-code.js';
import { prefixRegex } from '#app/utils/regex.js';
import type { NewPatientInput, SearchPatientsQuery } from '#app/validators/patient.validators.js';

export interface PatientDto {
  id: string;
  patientCode: string;
  name: string;
  mobile: string;
  gender: Gender;
  dateOfBirth: string | null;
}

export interface PatientRecord {
  _id: Types.ObjectId;
  patientCode: string;
  name: string;
  mobile: string;
  gender: Gender;
  dateOfBirth?: string | null | undefined;
}

const PATIENT_CODE_TERM = /^pat-\d+$/i;
const MOBILE_TERM = /^\+?[\d\s().-]+$/;

export const toPatientDto = (patient: PatientRecord): PatientDto => ({
  id: patient._id.toString(),
  patientCode: patient.patientCode,
  name: patient.name,
  mobile: patient.mobile,
  gender: patient.gender,
  dateOfBirth: patient.dateOfBirth ?? null,
});

/**
 * Reads a search term as a patient code ("PAT-000042"), the start of a mobile number, or the
 * start of a name. Each case is an exact or anchored match on an indexed field.
 */
const patientSearchFilter = (term: string): QueryFilter<Patient> => {
  if (PATIENT_CODE_TERM.test(term)) {
    return { patientCode: term.toUpperCase() };
  }
  if (MOBILE_TERM.test(term)) {
    return { mobile: prefixRegex(mobileSearchPrefix(term)) };
  }
  return { nameLower: prefixRegex(term.toLowerCase()) };
};

export const searchPatients = async (query: SearchPatientsQuery): Promise<Page<PatientDto>> => {
  const filter = query.search === undefined ? {} : patientSearchFilter(query.search);
  const [patients, total] = await Promise.all([
    PatientModel.find(filter)
      .sort({ nameLower: 1, _id: 1 })
      .skip(pageSkip(query))
      .limit(query.limit)
      .lean(),
    PatientModel.countDocuments(filter),
  ]);
  return toPage(patients.map(toPatientDto), total, query);
};

/** The next patient code, such as PAT-000042, from the atomic counter. */
export const reservePatientCode = async (): Promise<string> =>
  formatPatientCode(await nextSequence(PATIENT_CODE_COUNTER));

/** Saves a new patient as part of the caller's transaction. */
export const createPatientRecord = async (
  input: NewPatientInput,
  patientCode: string,
  session: ClientSession,
) => {
  const [patient] = await PatientModel.create(
    [
      {
        patientCode,
        name: input.name,
        mobile: input.mobile,
        gender: input.gender,
        ...(input.dateOfBirth === undefined ? {} : { dateOfBirth: input.dateOfBirth }),
      },
    ],
    { session },
  );
  if (!patient) {
    throw new Error('Patient was not created');
  }
  return patient;
};
