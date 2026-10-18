import { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type DialogPlacement = 'center' | 'side';

export interface DialogProps {
  open: boolean;
  /** Called for Esc and for a click on the backdrop. The parent decides whether to close. */
  onClose: () => void;
  /** Id of the element that names the dialog, usually its title. */
  labelledBy: string;
  describedBy?: string | undefined;
  /** `side` slides in from the left edge, for the navigation menu on small screens. */
  placement?: DialogPlacement | undefined;
  id?: string | undefined;
  children: ReactNode;
}

const PLACEMENTS: Readonly<Record<DialogPlacement, string>> = {
  center:
    'm-auto w-[calc(100%-2rem)] max-w-lg rounded-xl max-h-[calc(100dvh-2rem)] overflow-y-auto',
  side: 'mr-auto ml-0 h-dvh max-h-none w-72 max-w-[85vw] rounded-r-xl',
};

/**
 * A modal built on the native <dialog>: the browser traps focus inside it, makes the page behind
 * it inert and puts it above everything else. Focus goes back to whatever opened it.
 */
export const Dialog = ({
  open,
  onClose,
  labelledBy,
  describedBy,
  placement = 'center',
  id,
  children,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const requestClose = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) {
      return;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();

    // Esc fires "cancel": hand the decision to the parent instead of letting the browser close it.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    // A click on the backdrop lands on the <dialog> element itself, outside its content.
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        requestClose();
      }
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
      dialog.close();
      opener?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(
        'border border-line bg-paper p-0 text-ink shadow-overlay backdrop:bg-ink/45 open:animate-enter',
        PLACEMENTS[placement],
      )}
    >
      {open ? children : null}
    </dialog>
  );
};
