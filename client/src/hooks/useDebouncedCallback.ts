import { useEffect, useMemo, useRef } from 'react';

/**
 * A version of `callback` that runs once calls have paused for `delayMs`, with the latest
 * arguments. A call still waiting when the component unmounts is dropped.
 */
export const useDebouncedCallback = <A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number,
): ((...args: A) => void) => {
  const latest = useRef(callback);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  return useMemo(
    () =>
      (...args: A) => {
        if (timer.current !== null) {
          window.clearTimeout(timer.current);
        }
        timer.current = window.setTimeout(() => {
          timer.current = null;
          latest.current(...args);
        }, delayMs);
      },
    [delayMs],
  );
};
