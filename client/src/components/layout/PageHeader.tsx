import type { ReactNode } from 'react';

import { usePageTitle } from '@/hooks/usePageTitle';

export interface PageHeaderProps {
  /** The page's h1, also used for the browser tab's title. */
  title: string;
  description?: ReactNode;
  /** The page's main actions, aligned to the end of the header. */
  actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  usePageTitle(title);

  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? <div className="mt-1 text-sm text-ink-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
};
