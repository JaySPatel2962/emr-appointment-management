import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type BadgeTone = 'carbon' | 'leaf' | 'saffron' | 'vermilion' | 'slate';

export interface BadgeProps {
  tone: BadgeTone;
  /** An icon next to the text, so the meaning never rests on color alone. */
  icon?: LucideIcon | undefined;
  children: ReactNode;
}

const TONES: Readonly<Record<BadgeTone, string>> = {
  carbon: 'bg-carbon-soft text-carbon',
  leaf: 'bg-leaf-soft text-leaf',
  saffron: 'bg-saffron-soft text-saffron',
  vermilion: 'bg-vermilion-soft text-vermilion',
  slate: 'bg-slate-soft text-slate',
};

export const Badge = ({ tone, icon: Icon, children }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
      TONES[tone],
    )}
  >
    {Icon ? <Icon aria-hidden="true" size={13} strokeWidth={2.25} /> : null}
    {children}
  </span>
);
