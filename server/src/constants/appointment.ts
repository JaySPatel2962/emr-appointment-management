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
