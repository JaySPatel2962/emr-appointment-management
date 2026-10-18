import { Skeleton } from '@/components/ui/Skeleton';
import type { SlotStatus } from '@/constants/slot';
import { LiveIndicator } from '@/features/scheduler/components/LiveIndicator';
import type { LiveStatus } from '@/features/scheduler/hooks/useSchedulerRoom';
import { SlotLegend } from '@/features/slots/components/SlotLegend';
import type { Doctor } from '@/types/models';
import { formatDateLong } from '@/utils/date';

export interface DoctorDayHeaderProps {
  doctor: Doctor | undefined;
  date: string;
  counts: Readonly<Record<SlotStatus, number>> | null;
  live: LiveStatus;
}

/** Whose day this is, which day, how full it is, and whether it updates live. */
export const DoctorDayHeader = ({ doctor, date, counts, live }: DoctorDayHeaderProps) => (
  <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {doctor ? (
        <>
          <h2 className="text-xl font-bold text-ink">{doctor.name}</h2>
          <p className="text-sm text-ink-muted">
            {doctor.specialization}, {doctor.department.name}. {doctor.slotDurationMinutes}-minute
            slots.
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      <p className="mt-2 text-base font-semibold text-ink">{formatDateLong(date)}</p>
    </div>
    <div className="flex flex-col gap-2 sm:items-end">
      <LiveIndicator status={live} />
      {counts ? <SlotLegend counts={counts} /> : null}
    </div>
  </div>
);
