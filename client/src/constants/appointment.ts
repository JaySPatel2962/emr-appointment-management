export const APPOINTMENT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = Object.values(APPOINTMENT_STATUS);

export const APPOINTMENT_STATUS_LABELS: Readonly<Record<AppointmentStatus, string>> = {
  [APPOINTMENT_STATUS.SCHEDULED]: 'Scheduled',
  [APPOINTMENT_STATUS.ARRIVED]: 'Arrived',
  [APPOINTMENT_STATUS.COMPLETED]: 'Completed',
  [APPOINTMENT_STATUS.CANCELLED]: 'Cancelled',
};

/** Statuses whose purpose can still change (API.md, section 4). */
export const PURPOSE_EDITABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
];

/** Consultation notes stay editable after the visit; nothing changes once cancelled. */
export const NOTES_EDITABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.COMPLETED,
];

export const CANCELLABLE_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
];

export const PURPOSE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 2000;

/** The only fields the API sorts appointments by. */
export const APPOINTMENT_SORT_FIELDS = [
  'date',
  'createdAt',
  'patientName',
  'doctorName',
  'status',
] as const;

export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];
