import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';

export type DismissReason = 'escape' | 'outside';

/** Closes a popover on Esc, or on a press or focus move outside `container`, while it is open. */
export const useDismiss = (
  open: boolean,
  container: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void,
): void => {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!open) {
      return;
    }
    const isOutside = (target: EventTarget | null) =>
      !(target instanceof Node && container.current?.contains(target));
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Cancelling the key press also stops a surrounding modal dialog from closing with it.
        event.preventDefault();
        dismiss('escape');
      }
    };
    const handlePointer = (event: PointerEvent) => {
      if (isOutside(event.target)) {
        dismiss('outside');
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (isOutside(event.target)) {
        dismiss('outside');
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('focusin', handleFocus);
    };
  }, [open, container]);
};
