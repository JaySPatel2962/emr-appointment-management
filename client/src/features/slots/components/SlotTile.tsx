import { Plus } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router';

import { APPOINTMENT_STATUS_LABELS } from '@/constants/appointment';
import { SLOT_STATUS } from '@/constants/slot';
import type { SlotStatus } from '@/constants/slot';
import type { AppointmentSummary, Slot } from '@/types/models';
import { cn } from '@/utils/cn';

export interface SlotTileProps {
  slot: Slot;
  /** The status to show now, which may be PAST although the API sent AVAILABLE. */
  status: SlotStatus;
  /** The booking in this slot, for its patient's name. */
  appointment: AppointmentSummary | undefined;
  /** Where an available slot leads, or null where it can't be booked here (a doctor's view). */
  bookingHref: string | null;
  onOpenAppointment: (appointmentId: string) => void;
  /** Just changed by someone else: shows a brief glow. */
  highlighted: boolean;
}

const BASE =
  'flex min-h-16 flex-col justify-between gap-1 rounded-md border p-2.5 text-left transition-colors';

const Time = ({ value, className }: { value: string; className?: string }) => (
  <span className={cn('text-lg leading-none font-bold tabular-nums', className)}>{value}</span>
);

const SlotTileView = ({
  slot,
  status,
  appointment,
  bookingHref,
  onOpenAppointment,
  highlighted,
}: SlotTileProps) => {
  const flash = highlighted && 'animate-flash';

  if (status === SLOT_STATUS.BOOKED && slot.appointmentId !== undefined) {
    const { appointmentId } = slot;
    return (
      <button
        type="button"
        onClick={() => onOpenAppointment(appointmentId)}
        className={cn(
          BASE,
          'border-l-4 border-carbon/25 border-l-carbon bg-carbon-soft hover:bg-carbon/15',
          flash,
        )}
      >
        <Time value={slot.start} className="text-carbon-strong" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {appointment?.patient.name ?? 'Booked'}
          </span>
          <span className="block text-xs text-ink-muted">
            {appointment ? APPOINTMENT_STATUS_LABELS[appointment.status] : 'Booked'}
          </span>
        </span>
        <span className="sr-only">, booked. Show the appointment.</span>
      </button>
    );
  }

  if (status === SLOT_STATUS.AVAILABLE) {
    const content = (
      <>
        <Time value={slot.start} className="text-ink" />
        <span className="flex items-center gap-1 text-xs font-semibold text-leaf">
          {bookingHref ? <Plus aria-hidden="true" size={13} strokeWidth={2.5} /> : null}
          Available
        </span>
      </>
    );
    return bookingHref ? (
      <Link
        to={bookingHref}
        className={cn(BASE, 'border-leaf/45 bg-paper hover:border-leaf hover:bg-leaf-soft', flash)}
      >
        {content}
        <span className="sr-only">, book this slot</span>
      </Link>
    ) : (
      <div className={cn(BASE, 'border-leaf/45 bg-paper', flash)}>{content}</div>
    );
  }

  return (
    <div className={cn(BASE, 'border-line bg-hatch', flash)}>
      <Time value={slot.start} className="text-slate" />
      <span className="text-xs font-semibold text-slate">Past</span>
    </div>
  );
};

/**
 * One slot of the day sheet. Memoized: a live update or a refetch replaces only the changed
 * slot's object, so only that tile renders again; a busy day has dozens.
 */
export const SlotTile = memo(SlotTileView);
