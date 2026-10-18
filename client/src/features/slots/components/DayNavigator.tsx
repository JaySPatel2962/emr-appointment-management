import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { addDays } from '@/utils/date';

export interface DayNavigatorProps {
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  date: string;
  today: string;
  onChange: (date: string) => void;
  /** Days the doctor doesn't work, greyed out in the calendar. */
  isDateDisabled?: ((date: string) => boolean) | undefined;
}

/** The day being shown: the previous and next day, a calendar, and a jump back to today. */
export const DayNavigator = ({
  id,
  'aria-describedby': describedBy,
  date,
  today,
  onChange,
  isDateDisabled,
}: DayNavigatorProps) => (
  <div className="flex items-center gap-2">
    <Button
      variant="secondary"
      size="icon"
      aria-label="Previous day"
      disabled={date <= today}
      onClick={() => onChange(addDays(date, -1))}
    >
      <ChevronLeft aria-hidden="true" size={18} />
    </Button>
    <div className="min-w-0 flex-1">
      <DatePicker
        id={id}
        aria-describedby={describedBy}
        value={date}
        min={today}
        isDateDisabled={isDateDisabled}
        disabledLabel="no sessions"
        onChange={(next) => {
          if (next !== null) {
            onChange(next);
          }
        }}
      />
    </div>
    <Button
      variant="secondary"
      size="icon"
      aria-label="Next day"
      onClick={() => onChange(addDays(date, 1))}
    >
      <ChevronRight aria-hidden="true" size={18} />
    </Button>
    {/* Phones have no room for it; the calendar has its own "Today" button. */}
    {date === today ? null : (
      <Button variant="ghost" onClick={() => onChange(today)} className="@max-sm:hidden">
        Today
      </Button>
    )}
  </div>
);
