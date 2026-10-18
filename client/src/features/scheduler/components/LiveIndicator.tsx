import type { LiveStatus } from '@/features/scheduler/hooks/useSchedulerRoom';
import { cn } from '@/utils/cn';

const STATES: Readonly<Record<LiveStatus, { label: string; dot: string; text: string }>> = {
  live: { label: 'Live', dot: 'bg-leaf', text: 'text-leaf' },
  connecting: { label: 'Connecting', dot: 'bg-saffron', text: 'text-saffron' },
  offline: { label: 'Offline, reconnecting', dot: 'bg-vermilion', text: 'text-vermilion' },
};

export interface LiveIndicatorProps {
  status: LiveStatus;
}

/** Whether the grid is receiving other users' changes as they happen. */
export const LiveIndicator = ({ status }: LiveIndicatorProps) => {
  const { label, dot, text } = STATES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', text)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', dot)} />
      <span className="sr-only">Live updates: </span>
      {label}
    </span>
  );
};
