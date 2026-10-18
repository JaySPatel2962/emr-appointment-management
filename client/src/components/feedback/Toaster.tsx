import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { toast, toastStore } from '@/components/feedback/toast-store';
import type { ToastTone } from '@/components/feedback/toast-store';
import { cn } from '@/utils/cn';

const TONES: Readonly<Record<ToastTone, { icon: LucideIcon; iconClass: string }>> = {
  success: { icon: CircleCheck, iconClass: 'text-leaf' },
  error: { icon: CircleAlert, iconClass: 'text-vermilion' },
  info: { icon: Info, iconClass: 'text-carbon' },
};

/** Renders the toasts. Mounted once at the root; the list is a polite live region. */
export const Toaster = () => {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);

  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:justify-end"
    >
      <ol aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map(({ id, tone, message }) => {
          const { icon: Icon, iconClass } = TONES[tone];
          return (
            <li
              key={id}
              className="pointer-events-auto flex animate-enter items-start gap-3 rounded-xl border border-line bg-paper p-3 pl-4 text-sm text-ink shadow-overlay"
            >
              <Icon aria-hidden="true" size={18} className={cn('mt-0.5 shrink-0', iconClass)} />
              <p className="flex-1 py-0.5">{message}</p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => toast.dismiss(id)}
                className="grid size-7 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
