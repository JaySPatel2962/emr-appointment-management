import { skipToken, useQuery } from '@tanstack/react-query';

import { getDaySlots } from '@/features/slots/api';
import { STALE_TIME } from '@/services/query-client';

export const slotKeys = {
  all: ['slots'] as const,
  day: (doctorId: string, date: string) => [...slotKeys.all, doctorId, date] as const,
};

// Socket events keep an open grid current; this catches anything they miss (a dropped connection).
const SAFETY_REFETCH_MS = 60_000;

export const useDaySlots = (doctorId: string | null, date: string) =>
  useQuery({
    queryKey: slotKeys.day(doctorId ?? '', date),
    queryFn: doctorId === null ? skipToken : ({ signal }) => getDaySlots(doctorId, date, signal),
    staleTime: STALE_TIME.live,
    refetchInterval: SAFETY_REFETCH_MS,
  });
