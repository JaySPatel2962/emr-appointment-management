import { useQuery } from '@tanstack/react-query';

import { listDepartments } from '@/features/departments/api';
import { STALE_TIME } from '@/services/query-client';
import type { Department } from '@/types/models';

export const departmentKeys = {
  all: ['departments'] as const,
};

const EMPTY_NAMES: ReadonlyMap<string, string> = new Map();

export const useDepartments = () =>
  useQuery({
    queryKey: departmentKeys.all,
    queryFn: ({ signal }) => listDepartments(signal),
    staleTime: STALE_TIME.static,
  });

const toNameMap = (departments: Department[]): ReadonlyMap<string, string> =>
  new Map(departments.map((department) => [department.id, department.name]));

/** Department names by id, for appointments, which carry only a departmentId. */
export const useDepartmentNames = (): ReadonlyMap<string, string> => {
  const { data } = useQuery({
    queryKey: departmentKeys.all,
    queryFn: ({ signal }) => listDepartments(signal),
    staleTime: STALE_TIME.static,
    select: toNameMap,
  });
  return data ?? EMPTY_NAMES;
};
