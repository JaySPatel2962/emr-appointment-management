import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type AlertTone = 'error' | 'warning' | 'info' | 'success';

export interface AlertProps {
  tone: AlertTone;
  title?: string | undefined;
  children?: ReactNode;
  /** Buttons such as "Try again", placed after the message. */
  action?: ReactNode;
  className?: string | undefined;
}

const TONES: Readonly<Record<AlertTone, { icon: LucideIcon; classes: string }>> = {
  error: { icon: CircleAlert, classes: 'border-vermilion/30 bg-vermilion-soft text-vermilion' },
  warning: { icon: TriangleAlert, classes: 'border-saffron/30 bg-saffron-soft text-saffron' },
  info: { icon: Info, classes: 'border-carbon/25 bg-carbon-soft text-carbon' },
  success: { icon: CircleCheck, classes: 'border-leaf/30 bg-leaf-soft text-leaf' },
};

/**
 * An inline message about the screen it sits on. Errors and warnings interrupt (role="alert");
 * information and success wait their turn (role="status").
 */
export const Alert = ({ tone, title, children, action, className }: AlertProps) => {
  const { icon: Icon, classes } = TONES[tone];
  const urgent = tone === 'error' || tone === 'warning';

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', classes, className)}
    >
      <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-ink">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? (
            <div className={cn(title && 'mt-0.5', 'text-ink-muted')}>{children}</div>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </div>
    </div>
  );
};
