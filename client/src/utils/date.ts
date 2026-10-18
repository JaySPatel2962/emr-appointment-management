import { env } from '@/config/env';

// The API's dates are "YYYY-MM-DD" calendar dates on the clinic's clock, not instants. Arithmetic
// and formatting run on UTC midnight of that date, so no browser timezone can shift the day.
// "Today" and "now" are read in the clinic's timezone, whatever timezone the browser is in.

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const LOCALE = 'en-IN';

const toUtcDate = (date: string): Date => new Date(`${date}T00:00:00Z`);

const fromUtcDate = (value: Date): string => value.toISOString().slice(0, 10);

/** A real calendar date in "YYYY-MM-DD" form: "2026-02-30" is not one. */
export const isValidDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = toUtcDate(value);
  return !Number.isNaN(parsed.getTime()) && fromUtcDate(parsed) === value;
};

export const addDays = (date: string, days: number): string => {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtcDate(value);
};

/** The first day of the month `months` away from the month of `date`. */
export const addMonths = (date: string, months: number): string => {
  const value = toUtcDate(date);
  return fromUtcDate(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1)));
};

export const startOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

export const daysInMonth = (date: string): number => {
  const value = toUtcDate(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
};

/** 0 = Sunday ... 6 = Saturday, as the API numbers days. */
export const dayOfWeek = (date: string): number => toUtcDate(date).getUTCDay();

const clinicClockFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: env.clinicTimezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A moment on the clinic's wall clock: its date and the minute of that day. */
export interface ClinicMoment {
  date: string;
  minutes: number;
}

export const clinicMoment = (at: Date = new Date()): ClinicMoment => {
  const parts = clinicClockFormat.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '00';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
};

const formatters = {
  long: new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  medium: new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
  weekdayShort: new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }),
  month: new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', month: 'long', year: 'numeric' }),
  timestamp: new Intl.DateTimeFormat(LOCALE, {
    timeZone: env.clinicTimezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
};

/** "Monday, 19 October 2026" */
export const formatDateLong = (date: string): string => formatters.long.format(toUtcDate(date));

/** "19 Oct 2026" */
export const formatDate = (date: string): string => formatters.medium.format(toUtcDate(date));

/** "Mon, 19 Oct" */
export const formatDateShort = (date: string): string =>
  formatters.weekdayShort.format(toUtcDate(date));

/** "October 2026" */
export const formatMonth = (date: string): string => formatters.month.format(toUtcDate(date));

/** An API timestamp (ISO 8601, UTC) on the clinic's clock: "18 Oct 2026, 17:16". */
export const formatTimestamp = (iso: string): string => formatters.timestamp.format(new Date(iso));

/** Whole years from a "YYYY-MM-DD" birth date to `today`. */
export const ageOn = (dateOfBirth: string, today: string): number => {
  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return today.slice(5) < dateOfBirth.slice(5) ? years - 1 : years;
};
