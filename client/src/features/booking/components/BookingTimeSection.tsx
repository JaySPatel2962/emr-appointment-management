import { Alert } from '@/components/ui/Alert';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SLOT_STATUS } from '@/constants/slot';
import { DaySelectionFields } from '@/features/scheduler/components/DaySelectionFields';
import { DayOffNotice } from '@/features/slots/components/DayOffNotice';
import { SlotGridSkeleton } from '@/features/slots/components/SlotGridSkeleton';
import { SlotPicker } from '@/features/slots/components/SlotPicker';
import { useDoctorDay } from '@/features/slots/hooks/useDoctorDay';
import type { SlotSearch } from '@/features/slots/utils/slot-search';
import { slotStatusAt } from '@/features/slots/utils/slot-state';
import { useClinicClock } from '@/hooks/useClinicClock';
import { useRevealOnChange } from '@/hooks/useRevealOnChange';

export interface BookingTimeSectionProps {
  selection: SlotSearch;
  today: string;
  onChange: (patch: Partial<SlotSearch>) => void;
  /** Why the last attempt lost its slot (taken, or started), from the server's answer. */
  slotProblem: string | null;
  slotMissing: boolean;
}

/** The booking's when: a doctor, a day and one of that day's free slots. */
export const BookingTimeSection = ({
  selection,
  today,
  onChange,
  slotProblem,
  slotMissing,
}: BookingTimeSectionProps) => {
  const { doctorId, date, slot } = selection;
  const { doctor, day, slots, slotsQuery } = useDoctorDay(doctorId, date);
  const now = useClinicClock();
  const problemRef = useRevealOnChange<HTMLDivElement>(slotProblem, 'center');

  // A slot can be taken while the form is open: live updates turn it BOOKED under the user.
  const chosen = slot === null ? undefined : slots?.find((candidate) => candidate.start === slot);
  const chosenGone =
    chosen !== undefined && slotStatusAt(chosen, date, now) !== SLOT_STATUS.AVAILABLE;

  return (
    <div className="flex flex-col gap-5">
      <DaySelectionFields
        selection={selection}
        today={today}
        doctor={doctor}
        canChooseDoctor
        onChange={onChange}
        doctorError={slotMissing && doctorId === null ? 'Choose a doctor' : undefined}
      />

      <div ref={problemRef}>
        {slotProblem ? <Alert tone="warning">{slotProblem}</Alert> : null}
        {!slotProblem && chosenGone ? (
          <Alert tone="warning">
            {slot} was just booked by someone else, or has started. Choose another time.
          </Alert>
        ) : null}
      </div>

      {doctorId === null ? (
        <p className="text-sm text-ink-muted">Choose a doctor to see their free times.</p>
      ) : null}
      {doctorId !== null && slotsQuery.isPending ? <SlotGridSkeleton /> : null}
      {slotsQuery.error ? (
        <ErrorMessage
          title="Couldn't load the slots"
          error={slotsQuery.error}
          onRetry={() => void slotsQuery.refetch()}
          retrying={slotsQuery.isRefetching}
        />
      ) : null}
      {slots?.length === 0 && doctor ? (
        <DayOffNotice
          doctor={doctor}
          date={date}
          onShowDate={(next) => onChange({ date: next, slot: null })}
        />
      ) : null}
      {slots && slots.length > 0 ? (
        <SlotPicker
          date={date}
          slots={slots}
          day={day}
          value={chosenGone ? '' : (slot ?? '')}
          onChange={(start) => onChange({ slot: start })}
          error={
            slotMissing && doctorId !== null && (slot === null || chosenGone)
              ? 'Choose a time'
              : undefined
          }
        />
      ) : null}
    </div>
  );
};
