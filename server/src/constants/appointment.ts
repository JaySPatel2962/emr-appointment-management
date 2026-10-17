export const APPOINTMENT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

/** Statuses that hold a slot. A CANCELLED appointment frees its slot so it can be booked again. */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.COMPLETED,
];

/** The workflow: where each status may go next. COMPLETED and CANCELLED are final. */
export const STATUS_TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> =
  {
    [APPOINTMENT_STATUS.SCHEDULED]: [APPOINTMENT_STATUS.ARRIVED, APPOINTMENT_STATUS.CANCELLED],
    [APPOINTMENT_STATUS.ARRIVED]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED],
    [APPOINTMENT_STATUS.COMPLETED]: [],
    [APPOINTMENT_STATUS.CANCELLED]: [],
  };

export const PURPOSE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 2000;
