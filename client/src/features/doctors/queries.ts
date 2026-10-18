import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { getDoctor, listDoctors } from '@/features/doctors/api';
import type { DoctorFilters } from '@/features/doctors/api';
import { STALE_TIME } from '@/services/query-client';
import type { Doctor } from '@/types/models';

export const doctorKeys = {
  all: ['doctors'] as const,
  lists: () => [...doctorKeys.all, 'list'] as const,
  list: (filters: DoctorFilters) => [...doctorKeys.lists(), filters] as const,
  detail: (id: string) => [...doctorKeys.all, 'detail', id] as const,
};

export const useDoctors = (filters: DoctorFilters = {}) =>
  useQuery({
    queryKey: doctorKeys.list(filters),
    queryFn: ({ signal }) => listDoctors(filters, signal),
    staleTime: STALE_TIME.slow,
  });

/** A doctor that is already in a loaded list, so their page can show it straight away. */
const findInLists = (queryClient: QueryClient, id: string): Doctor | undefined =>
  queryClient
    .getQueriesData<Doctor[]>({ queryKey: doctorKeys.lists() })
    .flatMap(([, doctors]) => doctors ?? [])
    .find((doctor) => doctor.id === id);

export const useDoctor = (id: string | null) => {
  const queryClient = useQueryClient();
  return useQuery<Doctor>({
    queryKey: doctorKeys.detail(id ?? ''),
    queryFn: id === null ? skipToken : ({ signal }) => getDoctor(id, signal),
    staleTime: STALE_TIME.slow,
    placeholderData: () => (id === null ? undefined : findInLists(queryClient, id)),
  });
};
