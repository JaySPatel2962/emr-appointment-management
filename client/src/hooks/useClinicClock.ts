import { useSyncExternalStore } from 'react';

import { clinicMoment } from '@/utils/date';
import type { ClinicMoment } from '@/utils/date';

// One shared ticker for every component that needs the clinic's clock. It runs only while
// something is subscribed, and only notifies when the date or the minute actually changes.
const TICK_MS = 15_000;

let current: ClinicMoment = clinicMoment();
let timer: number | null = null;
const listeners = new Set<() => void>();

const tick = (): void => {
  const next = clinicMoment();
  if (next.date !== current.date || next.minutes !== current.minutes) {
    current = next;
    listeners.forEach((listener) => {
      listener();
    });
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (timer === null) {
    tick();
    timer = window.setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
};

const getSnapshot = (): ClinicMoment => current;

/** The clinic's date and minute of the day, kept current: "today" and past slots follow it. */
export const useClinicClock = (): ClinicMoment => useSyncExternalStore(subscribe, getSnapshot);
