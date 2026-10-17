/** Events the server pushes when an appointment changes. */
export const APPOINTMENT_EVENTS = {
  CREATED: 'appointment:created',
  UPDATED: 'appointment:updated',
  CANCELLED: 'appointment:cancelled',
} as const;

export type AppointmentEventName = (typeof APPOINTMENT_EVENTS)[keyof typeof APPOINTMENT_EVENTS];

/** Events a client sends to follow, or stop following, one doctor's scheduler for one date. */
export const SCHEDULER_EVENTS = {
  JOIN: 'scheduler:join',
  LEAVE: 'scheduler:leave',
} as const;
