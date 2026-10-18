import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Moves focus to `target` whenever `key` changes, but not on the first render. After a route
 * change this puts keyboard and screen reader users at the start of the new page.
 */
export const useFocusOnChange = (target: RefObject<HTMLElement | null>, key: string): void => {
  const previousKey = useRef(key);

  useEffect(() => {
    if (previousKey.current === key) {
      return;
    }
    previousKey.current = key;
    target.current?.focus();
  }, [key, target]);
};
