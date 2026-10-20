import { skipToken, useQuery } from '@tanstack/react-query';

import { searchPatients } from '@/features/patients/api';
import { isValidMobile, normalizeMobile } from '@/features/patients/utils/mobile';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { STALE_TIME } from '@/services/query-client';
import type { Patient } from '@/types/models';

const SEARCH_DELAY_MS = 300;
export const MIN_SEARCH_LENGTH = 2;

export const patientKeys = {
  all: ['patients'] as const,
  search: (term: string) => [...patientKeys.all, 'search', term] as const,
};

/**
 * Search as you type: the request waits until typing pauses for 300 ms, and runs from two
 * characters on. The previous results stay on screen while the next ones load, but not once
 * the term is too short to search: then there are no results to show.
 */
export const usePatientSearch = (input: string) => {
  const term = useDebouncedValue(input.trim(), SEARCH_DELAY_MS);
  const searching = term.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: patientKeys.search(term),
    queryFn: searching ? ({ signal }) => searchPatients(term, signal) : skipToken,
    staleTime: STALE_TIME.default,
    placeholderData: (previous) => (searching ? previous : undefined),
  });

  return {
    query,
    /** The term the results are for. */
    term,
    searching,
    /** True while the person is still typing, before the debounced search starts. */
    typing: input.trim() !== term,
  };
};

export interface MobileMatches {
  /** The registered patients with the number, up to the search limit. */
  patients: readonly Patient[];
  /** How many there are in all. */
  total: number;
}

const NO_MATCHES: MobileMatches = { patients: [], total: 0 };

/**
 * The registered patients who already have this mobile number, so the new-patient form can ask
 * "Is it one of these?" before registering someone twice. Families often share a number, so
 * this only asks; it never blocks. A number is looked up once it is complete and valid and the
 * typing has paused, and the matches go as soon as the number changes again.
 */
export const useMobileMatches = (mobile: string): MobileMatches => {
  const number = isValidMobile(mobile) ? normalizeMobile(mobile) : null;
  const term = useDebouncedValue(number, SEARCH_DELAY_MS);
  const current = term !== null && term === number;

  const query = useQuery({
    queryKey: patientKeys.search(term ?? ''),
    queryFn: current ? ({ signal }) => searchPatients(term, signal) : skipToken,
    staleTime: STALE_TIME.default,
  });

  return current && query.data
    ? { patients: query.data.items, total: query.data.meta.total }
    : NO_MATCHES;
};
