import { getPage } from '@/services/api';
import type { Page } from '@/types/api';
import type { Patient } from '@/types/models';

/** How many matches a search shows; a longer list is a sign to type more. */
export const PATIENT_SEARCH_LIMIT = 8;

/**
 * Patients matching a patient code (exact), the start of a mobile number, or the start of a name.
 */
export const searchPatients = (term: string, signal: AbortSignal): Promise<Page<Patient>> =>
  getPage<Patient>('/patients', { params: { search: term, limit: PATIENT_SEARCH_LIMIT }, signal });
