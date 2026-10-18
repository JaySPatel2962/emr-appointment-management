import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface PanelProps {
  title?: string | undefined;
  description?: ReactNode;
  /** Controls for the whole panel, placed at the end of its header. */
  actions?: ReactNode;
  children: ReactNode;
  /** Removes the body's padding, for a table or list that runs edge to edge. */
  flush?: boolean | undefined;
  className?: string | undefined;
}

/** A titled section of a page on a paper surface. */
export const Panel = ({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
}: PanelProps) => {
  const titleId = useId();

  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cn('rounded-xl border border-line bg-paper', className)}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <div className="mt-0.5 text-sm text-ink-muted">{description}</div>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(!flush && 'p-5')}>{children}</div>
    </section>
  );
};
