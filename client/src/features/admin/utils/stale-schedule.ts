import { CONFLICT_CODES } from '@/constants/conflicts';
import { HTTP_STATUS } from '@/constants/http';
import { ApiError } from '@/services/api-error';

// A schedule save carries the version the editor loaded. If someone saved the schedule since,
// the API refuses it with a 409 and `meta.code: SCHEDULE_STALE`, rather than letting it undo
// their change.

/** Whether the API refused a schedule save because it was based on an outdated version. */
export const isStaleSchedule = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  error.status === HTTP_STATUS.CONFLICT &&
  error.meta.code === CONFLICT_CODES.SCHEDULE_STALE;
