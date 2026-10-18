import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface StatTileProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** The icon's color: identity sits beside the text, never on it. */
  iconClass: string;
  /** A short line under the number, such as "Next at 10:15". */
  caption?: ReactNode;
}

/** One headline number. Large values keep proportional figures, which read better at size. */
export const StatTile = ({ label, value, icon: Icon, iconClass, caption }: StatTileProps) => (
  <div className="flex flex-col gap-1 rounded-xl border border-line bg-paper p-4">
    <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
      <Icon aria-hidden="true" size={16} className={cn('shrink-0', iconClass)} />
      {label}
    </p>
    <p className="text-3xl font-bold text-ink">{value}</p>
    {caption ? <p className="text-xs text-ink-muted">{caption}</p> : null}
  </div>
);
