import { CLINIC_TIMEZONE } from './config';

// Calendar dates ("YYYY-MM-DD") on the clinic's clock, as the API uses them. Arithmetic runs on
// UTC midnight of the date, so the machine's own timezone never shifts a day.

const clinicClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const clinicNow = (): { date: string; minutes: number } => {
  const parts = clinicClock.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '00';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
};

export const clinicToday = (): string => clinicNow().date;

/** Minutes since midnight on the clinic's clock. */
export const clinicMinutes = (): number => clinicNow().minutes;

export const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** 0 = Sunday ... 6 = Saturday. */
export const dayOfWeek = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first date on or after `from` that falls on one of `days`. */
export const nextDateOn = (from: string, days: readonly number[]): string => {
  let date = from;
  while (!days.includes(dayOfWeek(date))) {
    date = addDays(date, 1);
  }
  return date;
};

/** "HH:mm" for a number of minutes since midnight. */
export const timeOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * How many days ahead each spec books. Every spec works on day sheets no other spec touches, so
 * the specs stay independent of each other and of the order they run in.
 */
export const DAYS_AHEAD = {
  scheduler: 1,
  booking: 2,
  doubleBooking: 3,
  /** And the day after, which the live update test moves to. */
  realtime: 4,
  actions: 6,
  quality: 7,
  responsive: 8,
  /** The appointment list's seeded data. */
  list: 30,
} as const;

export const suiteDate = (spec: keyof typeof DAYS_AHEAD): string =>
  addDays(clinicToday(), DAYS_AHEAD[spec]);
