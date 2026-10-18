import { useEffect, useMemo, useRef } from 'react';

export interface Debounced<A extends unknown[]> {
  /** Calls the callback once calls have paused for the delay, with the latest arguments. */
  run: (...args: A) => void;
  /** Drops a call that is still waiting. */
  cancel: () => void;
}

/**
 * A version of `callback` that runs once calls have paused for `delayMs`. A call still waiting
 * when the component unmounts is dropped.
 */
export const useDebouncedCallback = <A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number,
): Debounced<A> => {
  const latest = useRef(callback);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    latest.current = callback;
  });

  const debounced = useMemo(() => {
    const cancel = (): void => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const run = (...args: A): void => {
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        latest.current(...args);
      }, delayMs);
    };
    return { run, cancel };
  }, [delayMs]);

  useEffect(() => debounced.cancel, [debounced]);

  return debounced;
};
