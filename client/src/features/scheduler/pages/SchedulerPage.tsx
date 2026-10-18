import { Stethoscope } from 'lucide-react';
import { useMemo } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Panel } from '@/components/ui/Panel';
import { FRONT_DESK_ROLES, ROLES } from '@/constants/roles';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { AppointmentDialogsHost } from '@/features/appointments/components/AppointmentDialogsHost';
import { useAppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import { useAppointmentDialogs } from '@/features/appointments/hooks/useAppointmentDialogs';
import { useDayAppointmentMap } from '@/features/appointments/queries';
import { DaySelectionFields } from '@/features/scheduler/components/DaySelectionFields';
import { DoctorDayHeader } from '@/features/scheduler/components/DoctorDayHeader';
import { useSchedulerRoom } from '@/features/scheduler/hooks/useSchedulerRoom';
import { DayOffNotice } from '@/features/slots/components/DayOffNotice';
import { SlotGrid } from '@/features/slots/components/SlotGrid';
import { SlotGridSkeleton } from '@/features/slots/components/SlotGridSkeleton';
import { useDoctorDay } from '@/features/slots/hooks/useDoctorDay';
import { useSlotSearch } from '@/features/slots/hooks/useSlotSearch';
import { countSlots } from '@/features/slots/utils/slot-counts';
import { bookingLink } from '@/features/slots/utils/slot-search';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { Slot } from '@/types/models';

export const SchedulerPage = () => {
  const user = useCurrentUser();
  const frontDesk = FRONT_DESK_ROLES.includes(user.role);
  const isDoctor = user.role === ROLES.DOCTOR;
  const { today, update, ...selection } = useSlotSearch();
  const { doctorId, departmentId, date } = selection;
  const { doctor, day, slots, slotsQuery } = useDoctorDay(doctorId, date);
  const { data: appointments } = useDayAppointmentMap(doctorId, date);
  const live = useSchedulerRoom(doctorId, date);
  const dialogs = useAppointmentDialogs();
  const actions = useAppointmentActions();
  const now = useClinicClock();

  const counts = useMemo(() => (slots ? countSlots(slots, date, now) : null), [slots, date, now]);

  // Open slots link to the booking form for that doctor, day and time (front desk only).
  const bookingHref = useMemo(
    () =>
      frontDesk && doctorId !== null
        ? (slot: Slot) => bookingLink({ doctorId, departmentId, date, slot: slot.start })
        : null,
    [frontDesk, doctorId, departmentId, date],
  );

  return (
    <>
      <PageHeader
        title="Scheduler"
        description={
          isDoctor
            ? 'Your day, slot by slot. It changes as patients are booked and arrive.'
            : 'Choose a doctor and a day. Open slots go straight to booking, and changes appear as they happen.'
        }
      />

      <div className="flex flex-col gap-6">
        <Panel>
          <DaySelectionFields
            selection={selection}
            today={today}
            doctor={doctor}
            canChooseDoctor={!isDoctor}
            onChange={update}
          />
        </Panel>

        {/* Other people's changes, announced to screen readers as they arrive. */}
        <p aria-live="polite" className="sr-only">
          {live.lastChange?.message ?? ''}
        </p>

        {doctorId === null ? (
          <Panel>
            <EmptyState
              icon={Stethoscope}
              title="Choose a doctor"
              description="Their slots for the day appear here, with who is booked and who has arrived."
            />
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col gap-5">
              <DoctorDayHeader doctor={doctor} date={date} counts={counts} live={live.status} />
              {slotsQuery.isPending ? <SlotGridSkeleton /> : null}
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
                  onShowDate={(next) => update({ date: next })}
                />
              ) : null}
              {slots && slots.length > 0 ? (
                <SlotGrid
                  date={date}
                  slots={slots}
                  day={day}
                  appointments={appointments}
                  bookingHref={bookingHref}
                  onOpenAppointment={dialogs.showDetails}
                  highlightedSlot={live.lastChange?.slotStart}
                />
              ) : null}
            </div>
          </Panel>
        )}
      </div>

      <AppointmentDialogsHost dialogs={dialogs} actions={actions} />
    </>
  );
};
