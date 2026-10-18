import { APPOINTMENT_STATUS } from '@/constants/appointment';

/**
 * The day's active load in workflow order: done, waiting, still to come. Cancelled
 * appointments hold no slot, so they are counted but not drawn. The mark colors are chart-only
 * tokens, checked for colour-blind separation in this order.
 */
export const STATUS_BAR_SEGMENTS = [
  { status: APPOINTMENT_STATUS.COMPLETED, label: 'Completed', mark: 'bg-leaf-mark' },
  { status: APPOINTMENT_STATUS.ARRIVED, label: 'Waiting', mark: 'bg-saffron-mark' },
  { status: APPOINTMENT_STATUS.SCHEDULED, label: 'Still to come', mark: 'bg-carbon-mark' },
] as const;
