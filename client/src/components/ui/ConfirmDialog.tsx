import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  /** Names the action exactly, e.g. "Cancel appointment", never just "OK". */
  confirmLabel: string;
  /** The safe way out, e.g. "Keep appointment". It gets the initial focus. */
  cancelLabel?: string | undefined;
  tone?: 'danger' | 'primary' | undefined;
  pending?: boolean | undefined;
  /** Shown inside the dialog, which covers the rest of the page while it is open. */
  error?: string | null | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Go back',
  tone = 'danger',
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={description}
    dismissible={!pending}
    showCloseButton={false}
    footer={
      <>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {error ? <Alert tone="error">{error}</Alert> : null}
  </Modal>
);
