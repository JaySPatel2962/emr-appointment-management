import { CircleAlert } from 'lucide-react';
import { useId, useMemo } from 'react';

import { SLOT_STATUS, SLOT_STATUS_LABELS } from '@/constants/slot';
import { BreakBand } from '@/features/slots/components/BreakBand';
import { buildDaySheet } from '@/features/slots/utils/day-sheet';
import { slotStatusAt } from '@/features/slots/utils/slot-state';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { DaySchedule, Slot } from '@/types/models';
import { cn } from '@/utils/cn';
import { formatTimeRange } from '@/utils/time';

export interface SlotPickerProps {
  date: string;
  slots: readonly Slot[];
  day: DaySchedule | undefined;
  /** The chosen slot's start, or "" for none. */
  value: string;
  onChange: (slotStart: string) => void;
  error?: string | undefined;
}

const TILE =
  'group flex min-h-14 flex-col justify-between gap-0.5 rounded-md border p-2 has-focus-visible:outline-2 has-focus-visible:outline-carbon';

/**
 * The booking form's choice of time: the day laid out like the scheduler, as native radio
 * buttons, so arrow keys move between free slots and taken or past ones can't be chosen.
 */
export const SlotPicker = ({ date, slots, day, value, onChange, error }: SlotPickerProps) => {
  const now = useClinicClock();
  const name = useId();
  const errorId = useId();
  const blocks = useMemo(() => buildDaySheet(slots, day), [slots, day]);

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-ink">Time</legend>
      <div className="flex flex-col gap-4">
        {blocks.map((block) =>
          block.kind === 'break' ? (
            <BreakBand key={`break-${block.range.start}`} range={block.range} />
          ) : (
            <div key={`session-${block.range.start}`}>
              <p className="mb-1.5 text-xs font-semibold text-ink-muted">
                {block.label}, {formatTimeRange(block.range.start, block.range.end)}
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
                {block.entries.map((entry) => {
                  if (entry.kind === 'break') {
                    return (
                      <BreakBand
                        key={`break-${entry.range.start}`}
                        range={entry.range}
                        className="col-span-full"
                      />
                    );
                  }
                  const status = slotStatusAt(entry.slot, date, now);
                  const free = status === SLOT_STATUS.AVAILABLE;
                  return (
                    <label
                      key={entry.slot.start}
                      className={cn(
                        TILE,
                        free &&
                          'cursor-pointer border-leaf/45 bg-paper hover:bg-leaf-soft has-checked:border-carbon has-checked:bg-carbon has-checked:text-white',
                        status === SLOT_STATUS.BOOKED &&
                          'cursor-not-allowed border-carbon/20 bg-carbon-soft text-ink-muted',
                        status === SLOT_STATUS.PAST &&
                          'cursor-not-allowed border-line bg-hatch text-slate',
                      )}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={entry.slot.start}
                        checked={value === entry.slot.start}
                        disabled={!free}
                        onChange={() => onChange(entry.slot.start)}
                        className="sr-only"
                      />
                      <span className="text-base leading-none font-bold tabular-nums">
                        {entry.slot.start}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          free && 'text-leaf group-has-checked:text-white',
                        )}
                      >
                        {free && value === entry.slot.start ? 'Chosen' : SLOT_STATUS_LABELS[status]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-1.5 text-sm text-vermilion">
          <CircleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};
