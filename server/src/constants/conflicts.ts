/**
 * Why a 409 was answered, in `meta.code`, where a client must tell one conflict from another.
 * A double booking (`Slot already booked`) and a used email carry no code.
 */
export const CONFLICT_CODES = {
  /** The schedule was saved by someone else since this client loaded it. */
  SCHEDULE_STALE: 'SCHEDULE_STALE',
  /** The schedule would leave booked appointments without their slots. */
  APPOINTMENTS_STRANDED: 'APPOINTMENTS_STRANDED',
} as const;

export type ConflictCode = (typeof CONFLICT_CODES)[keyof typeof CONFLICT_CODES];
