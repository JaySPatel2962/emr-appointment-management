import { SLOT_STATUS } from '@/constants/slot';
import type { SlotStatus } from '@/constants/slot';
import { cn } from '@/utils/cn';

const SWATCHES: Readonly<Record<SlotStatus, string>> = {
  [SLOT_STATUS.AVAILABLE]: 'border border-leaf/60 bg-paper',
  [SLOT_STATUS.BOOKED]: 'border-l-4 border-carbon bg-carbon-soft',
  [SLOT_STATUS.PAST]: 'border border-line bg-hatch',
};

const LABELS: Readonly<Record<SlotStatus, string>> = {
  [SLOT_STATUS.AVAILABLE]: 'available',
  [SLOT_STATUS.BOOKED]: 'booked',
  [SLOT_STATUS.PAST]: 'past',
};

export interface SlotLegendProps {
  counts: Readonly<Record<SlotStatus, number>>;
}

/** What each tile style means, with how many slots have it. */
export const SlotLegend = ({ counts }: SlotLegendProps) => (
  <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted" aria-label="Slots">
    {(Object.keys(SWATCHES) as SlotStatus[]).map((status) => (
      <li key={status} className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('size-4 rounded', SWATCHES[status])} />
        <span>
          <span className="font-bold text-ink tabular-nums">{counts[status]}</span> {LABELS[status]}
        </span>
      </li>
    ))}
  </ul>
);
