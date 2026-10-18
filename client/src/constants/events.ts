/** Events the server pushes after an appointment change is saved. */
export const APPOINTMENT_EVENTS = {
  CREATED: 'appointment:created',
  UPDATED: 'appointment:updated',
  CANCELLED: 'appointment:cancelled',
} as const;

export type AppointmentEventName = (typeof APPOINTMENT_EVENTS)[keyof typeof APPOINTMENT_EVENTS];

/** Events the client sends to follow, or stop following, one doctor's day. */
export const SCHEDULER_EVENTS = {
  JOIN: 'scheduler:join',
  LEAVE: 'scheduler:leave',
} as const;
