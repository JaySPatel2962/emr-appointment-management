import { STATUS_BAR_SEGMENTS } from '@/features/dashboard/utils/status-segments';
import type { StatusCounts } from '@/features/dashboard/utils/summary';
import { cn } from '@/utils/cn';

export interface StatusBarProps {
  counts: StatusCounts;
  /** The total the bar's full width stands for: the busiest doctor, so rows compare. */
  scale: number;
  /** 12px for the day overview, 8px inside table rows. */
  size?: 'md' | 'sm' | undefined;
}

/**
 * A thin stacked bar of one day's load. Segments are separated by a 2px gap (never a border)
 * and the data end is rounded. The numbers sit next to it in text, so the bar is hidden from
 * screen readers; hovering a segment shows its count.
 */
export const StatusBar = ({ counts, scale, size = 'md' }: StatusBarProps) => {
  const segments = STATUS_BAR_SEGMENTS.filter((segment) => counts[segment.status] > 0);
  const total = segments.reduce((sum, segment) => sum + counts[segment.status], 0);

  return (
    <div
      aria-hidden="true"
      className={cn('flex w-full overflow-hidden', size === 'md' ? 'h-3' : 'h-2')}
    >
      <div
        className="flex h-full gap-0.5 overflow-hidden rounded-r"
        style={{ width: `${String(scale === 0 ? 0 : (total / scale) * 100)}%` }}
      >
        {segments.map((segment) => (
          <div
            key={segment.status}
            title={`${segment.label}: ${String(counts[segment.status])}`}
            className={cn('h-full min-w-1 hover:opacity-80', segment.mark)}
            style={{ flexGrow: counts[segment.status], flexBasis: 0 }}
          />
        ))}
      </div>
    </div>
  );
};
