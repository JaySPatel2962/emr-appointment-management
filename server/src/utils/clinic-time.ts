import { DateTime } from 'luxon';

import { env } from '#app/config/env.js';
import { MINUTES_PER_HOUR } from '#app/utils/time.js';

/** A moment on the clinic's wall clock: its calendar date and the minute of that day. */
export interface ClinicMoment {
  date: string;
  minutes: number;
}

/** The clinic's current date and time in CLINIC_TIMEZONE, whatever the server's timezone is. */
export const clinicNow = (at: Date = new Date()): ClinicMoment => {
  const local = DateTime.fromJSDate(at, { zone: env.CLINIC_TIMEZONE });
  return {
    date: local.toFormat('yyyy-MM-dd'),
    minutes: local.hour * MINUTES_PER_HOUR + local.minute,
  };
};
