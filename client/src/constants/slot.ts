export const SLOT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  PAST: 'PAST',
} as const;

export type SlotStatus = (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];

export const SLOT_STATUS_LABELS: Readonly<Record<SlotStatus, string>> = {
  [SLOT_STATUS.AVAILABLE]: 'Available',
  [SLOT_STATUS.BOOKED]: 'Booked',
  [SLOT_STATUS.PAST]: 'Past',
};
