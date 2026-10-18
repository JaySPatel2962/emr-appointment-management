import { Coffee } from 'lucide-react';

import type { TimeRange } from '@/types/models';
import { formatTimeRange } from '@/utils/time';
import { cn } from '@/utils/cn';

export interface BreakBandProps {
  range: TimeRange;
  className?: string | undefined;
}

/** A break, drawn where it falls in the day: no slot is ever offered inside it. */
export const BreakBand = ({ range, className }: BreakBandProps) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-md border border-dashed border-line-strong bg-hatch px-3 py-2 text-sm text-slate',
      className,
    )}
  >
    <Coffee aria-hidden="true" size={16} className="shrink-0" />
    <span>
      <span className="font-semibold">Break</span>, {formatTimeRange(range.start, range.end)}, no
      appointments
    </span>
  </div>
);
