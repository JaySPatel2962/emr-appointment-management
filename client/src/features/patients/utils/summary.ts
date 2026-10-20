import { GENDER_LABELS } from '@/constants/patient';
import { formatMobile } from '@/features/patients/utils/mobile';
import type { Patient } from '@/types/models';
import { ageOn } from '@/utils/date';

/** "PAT-000001, 98765 43210, Female, 36 years": what tells two patients of one name apart. */
export const patientSummary = (patient: Patient, today: string): string =>
  [
    patient.patientCode,
    formatMobile(patient.mobile),
    GENDER_LABELS[patient.gender],
    patient.dateOfBirth ? `${String(ageOn(patient.dateOfBirth, today))} years` : null,
  ]
    .filter(Boolean)
    .join(', ');
