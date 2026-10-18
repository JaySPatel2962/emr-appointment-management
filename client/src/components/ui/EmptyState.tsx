import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon?: LucideIcon | undefined;
  title: string;
  description?: ReactNode;
  /** What to do next: an empty screen is an invitation to act. */
  action?: ReactNode;
  /** 1 when the message is the whole page (404, 403); 2 inside a page. */
  headingLevel?: 1 | 2 | 3 | undefined;
  className?: string | undefined;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) => {
  const Heading = `h${headingLevel}` as const;

  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-full bg-carbon-soft text-carbon">
          <Icon aria-hidden="true" size={24} />
        </span>
      ) : null}
      <Heading className="text-lg font-bold text-ink">{title}</Heading>
      {description ? <div className="text-sm text-ink-muted">{description}</div> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
};
