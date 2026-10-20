import { useEffect, useRef } from 'react';

/**
 * A ref for a message that can appear away from where the user is looking, such as the error
 * after pressing the button at the bottom of a long form. Whenever `message` changes to
 * something other than null, its element is scrolled into view.
 */
export const useRevealOnChange = <T extends HTMLElement>(
  message: object | string | null,
  block: ScrollLogicalPosition = 'nearest',
) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (message !== null) {
      ref.current?.scrollIntoView({ block, behavior: 'smooth' });
    }
  }, [message, block]);

  return ref;
};
