import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Spans both columns, for long values such as notes. */
  wide?: boolean | undefined;
}

export interface DetailListProps {
  items: readonly DetailItem[];
}

/** Label and value pairs, as a description list in two columns on wider screens. */
export const DetailList = ({ items }: DetailListProps) => (
  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.label} className={cn('min-w-0', item.wide && 'sm:col-span-2')}>
        <dt className="text-xs font-semibold text-ink-muted">{item.label}</dt>
        <dd className="mt-0.5 text-sm break-words text-ink">{item.value}</dd>
      </div>
    ))}
  </dl>
);
