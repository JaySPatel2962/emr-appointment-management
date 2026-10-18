import { X } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { Dialog } from '@/components/ui/Dialog';
import type { DialogSize } from '@/components/ui/Dialog';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The actions, such as Cancel and Save. Stacked on phones, side by side on wider screens. */
  footer?: ReactNode;
  /** False while an action runs: Esc, the backdrop and the close button then do nothing. */
  dismissible?: boolean | undefined;
  /** False hides the corner close button, so the first action gets the initial focus. */
  showCloseButton?: boolean | undefined;
  size?: DialogSize | undefined;
}

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  showCloseButton = true,
  size = 'md',
}: ModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const requestClose = () => {
    if (dismissible) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      size={size}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </div>
            ) : null}
          </div>
          {showCloseButton ? (
            <button
              type="button"
              aria-label="Close"
              disabled={!dismissible}
              onClick={requestClose}
              className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            >
              <X aria-hidden="true" size={18} />
            </button>
          ) : null}
        </header>
        {children ? <div className="overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        ) : null}
      </div>
    </Dialog>
  );
};
