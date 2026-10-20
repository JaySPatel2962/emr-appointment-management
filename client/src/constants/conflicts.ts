/**
 * The API's reasons for a 409, in the response's `meta.code`, where the app must tell one
 * conflict from another (server/src/constants/conflicts.ts).
 */
export const CONFLICT_CODES = {
  SCHEDULE_STALE: 'SCHEDULE_STALE',
} as const;
