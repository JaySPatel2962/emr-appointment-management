import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { AppointmentListParams } from '@/features/appointments/api';
import {
  parseListParams,
  serializeListParams,
  withoutFilters,
} from '@/features/appointments/utils/list-params';

/** The appointment list's page, sort and filters, read from and written to the URL. */
export const useAppointmentListParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseListParams(searchParams), [searchParams]);

  /** Changes some params. Any change other than the page goes back to page 1. */
  const update = useCallback(
    (patch: Partial<AppointmentListParams>) => {
      setSearchParams(
        (current) => {
          const next = { ...parseListParams(current), ...patch };
          return serializeListParams(patch.page === undefined ? { ...next, page: 1 } : next);
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((current) => serializeListParams(withoutFilters(parseListParams(current))), {
      replace: true,
    });
  }, [setSearchParams]);

  return { params, update, clearFilters };
};
