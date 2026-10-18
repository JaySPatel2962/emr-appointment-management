import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  clampDate,
  dateForKey,
  monthGrid,
  shiftMonths,
  startOfWeek,
} from '@/components/ui/calendar';
import { fieldClasses } from '@/components/ui/field-styles';
import { WEEKDAY_LABELS } from '@/constants/doctor';
import { useClinicClock } from '@/hooks/useClinicClock';
import { useDismiss } from '@/hooks/useDismiss';
import { cn } from '@/utils/cn';
import {
  addDays,
  addMonths,
  formatDateLong,
  formatDateWithWeekday,
  formatMonth,
  startOfMonth,
} from '@/utils/date';

export interface DatePickerProps {
  /** The trigger's id, so a <FormField> label points at it. */
  id?: string | undefined;
  value: string | null;
  onChange: (date: string | null) => void;
  /** Earliest choosable date ("YYYY-MM-DD"), such as the clinic's today. */
  min?: string | undefined;
  max?: string | undefined;
  /** Blocks extra dates, such as a doctor's days off. */
  isDateDisabled?: ((date: string) => boolean) | undefined;
  /** Added to a blocked day's label: "Sunday, 18 October 2026, no sessions". */
  disabledLabel?: string | undefined;
  placeholder?: string | undefined;
  /** Offers a "Clear" button, for optional dates such as a filter. */
  clearable?: boolean | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: true | undefined;
}

const POPOVER_WIDTH_PX = 304;

const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const label = WEEKDAY_LABELS[(index + 1) % 7] ?? '';
  return { full: label, short: label.slice(0, 2) };
});

/**
 * A button that shows the chosen date and opens a month calendar, following the WAI-ARIA date
 * picker pattern: arrows move by day and week, Page Up/Down by month, Home/End to the week's
 * ends, Enter picks, Esc closes. Unavailable days stay reachable but can't be picked.
 */
export const DatePicker = ({
  id,
  value,
  onChange,
  min,
  max,
  isDateDisabled,
  disabledLabel = 'unavailable',
  placeholder = 'Choose a date',
  clearable = false,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: DatePickerProps) => {
  const { date: today } = useClinicClock();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(() => clampDate(value ?? today, min, max));
  const [alignEnd, setAlignEnd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const focusGrid = useRef(false);
  const popoverId = useId();
  const monthLabelId = useId();

  const isBlocked = useCallback(
    (date: string) =>
      (min !== undefined && date < min) ||
      (max !== undefined && date > max) ||
      (isDateDisabled?.(date) ?? false),
    [min, max, isDateDisabled],
  );

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  };

  useDismiss(open, rootRef, (reason) => {
    close(reason === 'escape');
  });

  // Keyboard moves within the grid change `focused`; this puts DOM focus on that day's button.
  useEffect(() => {
    if (!open || !focusGrid.current) {
      return;
    }
    focusGrid.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    setAlignEnd(rect !== undefined && rect.left + POPOVER_WIDTH_PX > window.innerWidth - 8);
    setFocused(clampDate(value ?? today, min, max));
    focusGrid.current = true;
    setOpen(true);
  };

  const pick = (date: string) => {
    if (isBlocked(date)) {
      return;
    }
    onChange(date);
    close(true);
  };

  const handleDayKey = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const next = dateForKey(event.key, date, event.shiftKey);
    if (next === null) {
      return;
    }
    event.preventDefault();
    focusGrid.current = true;
    setFocused(clampDate(next, min, max));
  };

  const showMonth = (months: number) =>
    setFocused(clampDate(shiftMonths(focused, months), min, max));

  const monthStart = startOfMonth(focused);
  const canGoBack = min === undefined || addDays(monthStart, -1) >= startOfMonth(min);
  const canGoForward = max === undefined || addMonths(monthStart, 1) <= max;
  const todayAllowed = !isBlocked(today);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={describedBy}
        data-invalid={invalid ? '' : undefined}
        onClick={toggle}
        className={fieldClasses('flex h-10 items-center justify-between gap-2 text-left')}
      >
        <span className={cn('truncate', value === null && 'text-ink-subtle')}>
          {value === null ? placeholder : formatDateWithWeekday(value)}
        </span>
        <CalendarDays aria-hidden="true" size={18} className="shrink-0 text-ink-muted" />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={monthLabelId}
          className={cn(
            'absolute top-full z-40 mt-2 w-76 animate-enter rounded-xl border border-line bg-paper p-3 shadow-overlay',
            alignEnd ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => showMonth(-1)}
              className="grid size-9 place-items-center rounded-lg text-ink hover:bg-ink/5 disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <p id={monthLabelId} aria-live="polite" className="text-sm font-bold text-ink">
              {formatMonth(focused)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canGoForward}
              onClick={() => showMonth(1)}
              className="grid size-9 place-items-center rounded-lg text-ink hover:bg-ink/5 disabled:opacity-35"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>

          <table ref={gridRef} role="grid" aria-labelledby={monthLabelId} className="w-full">
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th
                    key={day.full}
                    scope="col"
                    abbr={day.full}
                    className="pb-1 text-center text-xs font-semibold text-ink-muted"
                  >
                    {day.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(focused).map((week) => (
                <tr key={startOfWeek(week.find((day) => day !== null) ?? focused)}>
                  {week.map((date, index) => {
                    if (date === null) {
                      return <td key={`pad-${String(index)}`} />;
                    }
                    const blocked = isBlocked(date);
                    const selected = date === value;
                    // In a role="grid" table every cell is a gridcell; the day button carries the state.
                    return (
                      <td key={date} className="p-0.5">
                        <button
                          type="button"
                          data-date={date}
                          tabIndex={date === focused ? 0 : -1}
                          aria-label={`${formatDateLong(date)}${blocked ? `, ${disabledLabel}` : ''}`}
                          aria-pressed={selected}
                          aria-disabled={blocked || undefined}
                          aria-current={date === today ? 'date' : undefined}
                          onClick={() => pick(date)}
                          onKeyDown={(event) => handleDayKey(event, date)}
                          className={cn(
                            'grid h-9 w-full place-items-center rounded-lg text-sm tabular-nums',
                            selected && 'bg-carbon font-bold text-white',
                            !selected &&
                              blocked &&
                              'cursor-not-allowed text-ink-subtle/60 line-through',
                            !selected && !blocked && 'text-ink hover:bg-carbon-soft',
                            date === today &&
                              !selected &&
                              'font-bold ring-1 ring-carbon ring-inset',
                          )}
                        >
                          {Number(date.slice(8, 10))}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
            <button
              type="button"
              disabled={!todayAllowed}
              onClick={() => pick(today)}
              className="rounded-md px-2 py-1 text-sm font-semibold text-carbon hover:bg-carbon-soft disabled:opacity-40"
            >
              Today
            </button>
            {clearable && value !== null ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  close(true);
                }}
                className="rounded-md px-2 py-1 text-sm font-semibold text-ink-muted hover:bg-ink/5"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
