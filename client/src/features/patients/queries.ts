import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';

import { searchPatients } from '@/features/patients/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { STALE_TIME } from '@/services/query-client';

const SEARCH_DELAY_MS = 300;
export const MIN_SEARCH_LENGTH = 2;

export const patientKeys = {
  all: ['patients'] as const,
  search: (term: string) => [...patientKeys.all, 'search', term] as const,
};

/**
 * Search as you type: the request waits until typing pauses for 300 ms, and runs from two
 * characters on. The previous results stay on screen while the next ones load.
 */
export const usePatientSearch = (input: string) => {
  const term = useDebouncedValue(input.trim(), SEARCH_DELAY_MS);
  const searching = term.length >= MIN_SEARCH_LENGTH;

  const query = useQuery({
    queryKey: patientKeys.search(term),
    queryFn: searching ? ({ signal }) => searchPatients(term, signal) : skipToken,
    staleTime: STALE_TIME.default,
    placeholderData: keepPreviousData,
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
