import { useMemo } from 'react';

import { BreakBand } from '@/features/slots/components/BreakBand';
import { SlotTile } from '@/features/slots/components/SlotTile';
import { buildDaySheet } from '@/features/slots/utils/day-sheet';
import { slotStatusAt } from '@/features/slots/utils/slot-state';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { AppointmentSummary, DaySchedule, Slot } from '@/types/models';
import { formatTimeRange } from '@/utils/time';

export interface SlotGridProps {
  date: string;
  slots: readonly Slot[];
  /** The doctor's sessions and breaks for this date, to lay the slots out by session. */
  day: DaySchedule | undefined;
  appointments: ReadonlyMap<string, AppointmentSummary> | undefined;
  /** The booking link for an available slot, or null where the user can't book. */
  bookingHref: ((slot: Slot) => string) | null;
  onOpenAppointment: (appointmentId: string) => void;
  /** The start of a slot that someone else just changed. */
  highlightedSlot?: string | null | undefined;
}

const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2';

/** The day sheet: each session with its slots, and the breaks where they fall. */
export const SlotGrid = ({
  date,
  slots,
  day,
  appointments,
  bookingHref,
  onOpenAppointment,
  highlightedSlot,
}: SlotGridProps) => {
  const now = useClinicClock();
  const blocks = useMemo(() => buildDaySheet(slots, day), [slots, day]);

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block) =>
        block.kind === 'break' ? (
          <BreakBand key={`break-${block.range.start}`} range={block.range} />
        ) : (
          <section key={`session-${block.range.start}`} aria-label={`${block.label} session`}>
            <h3 className="mb-2 flex items-baseline gap-2 text-sm font-bold text-ink">
              {block.label}
              <span className="font-semibold text-ink-muted tabular-nums">
                {formatTimeRange(block.range.start, block.range.end)}
              </span>
            </h3>
            <ul className={TILE_GRID}>
              {block.entries.map((entry) =>
                entry.kind === 'break' ? (
                  <li key={`break-${entry.range.start}`} className="col-span-full">
                    <BreakBand range={entry.range} />
                  </li>
                ) : (
                  <li key={entry.slot.start} className="grid">
                    <SlotTile
                      slot={entry.slot}
                      status={slotStatusAt(entry.slot, date, now)}
                      appointment={
                        entry.slot.appointmentId === undefined
                          ? undefined
                          : appointments?.get(entry.slot.appointmentId)
                      }
                      bookingHref={bookingHref ? bookingHref(entry.slot) : null}
                      onOpenAppointment={onOpenAppointment}
                      highlighted={highlightedSlot === entry.slot.start}
                    />
                  </li>
                ),
              )}
            </ul>
          </section>
        ),
      )}
    </div>
  );
};
