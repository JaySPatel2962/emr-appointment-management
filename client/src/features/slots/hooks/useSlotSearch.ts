import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { readSlotSearch, writeSlotSearch } from '@/features/slots/utils/slot-search';
import type { SlotSearch } from '@/features/slots/utils/slot-search';
import { useClinicClock } from '@/hooks/useClinicClock';

/** The doctor, department, date and slot in the URL, with a way to change them. */
export const useSlotSearch = () => {
  const user = useCurrentUser();
  const { date: today } = useClinicClock();
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = useMemo(
    () => readSlotSearch(searchParams, today, user),
    [searchParams, today, user],
  );

  const update = useCallback(
    (patch: Partial<SlotSearch>) => {
      setSearchParams((current) => writeSlotSearch(current, patch), { replace: true });
    },
    [setSearchParams],
  );

  return { ...selection, today, update };
};
