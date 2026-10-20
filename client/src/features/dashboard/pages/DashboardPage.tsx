import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  CircleX,
  DoorOpen,
} from 'lucide-react';
import { useMemo } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Panel } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { FRONT_DESK_ROLES, ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { AppointmentDialogsHost } from '@/features/appointments/components/AppointmentDialogsHost';
import { useAppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import { useAppointmentDialogs } from '@/features/appointments/hooks/useAppointmentDialogs';
import { useDayAppointments } from '@/features/appointments/queries';
import { AppointmentQueue } from '@/features/dashboard/components/AppointmentQueue';
import { DoctorLoadTable } from '@/features/dashboard/components/DoctorLoadTable';
import { StatTile } from '@/features/dashboard/components/StatTile';
import { StatusBar } from '@/features/dashboard/components/StatusBar';
import { STATUS_BAR_SEGMENTS } from '@/features/dashboard/utils/status-segments';
import { summarizeDay } from '@/features/dashboard/utils/summary';
import { useDoctors } from '@/features/doctors/queries';
import { useClinicClock } from '@/hooks/useClinicClock';
import { cn } from '@/utils/cn';
import { formatDateLong } from '@/utils/date';

const StatTilesSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status">
    <span className="sr-only">Loading today's appointments</span>
    {Array.from({ length: 4 }, (_, index) => (
      <Skeleton key={index} className="h-28 rounded-xl" />
    ))}
  </div>
);

export const DashboardPage = () => {
  const user = useCurrentUser();
  const isDoctor = user.role === ROLES.DOCTOR;
  const isAdmin = user.role === ROLES.SUPER_ADMIN;
  const frontDesk = FRONT_DESK_ROLES.includes(user.role);
  const now = useClinicClock();
  const today = now.date;
  // A doctor's list is scoped to their own appointments by the API itself.
  const dayQuery = useDayAppointments(null, today);
  const doctorsQuery = useDoctors();
  const dialogs = useAppointmentDialogs();
  const actions = useAppointmentActions();

  const summary = useMemo(
    () => (dayQuery.data ? summarizeDay(dayQuery.data, now) : null),
    [dayQuery.data, now],
  );
  const next = summary?.upcoming[0];

  return (
    <>
      <PageHeader
        title={isDoctor ? 'Your day' : 'Today at the clinic'}
        description={formatDateLong(today)}
        actions={
          <>
            <ButtonLink to={ROUTES.scheduler} variant="secondary">
              <CalendarDays aria-hidden="true" size={18} />
              Open the scheduler
            </ButtonLink>
            {frontDesk ? (
              <ButtonLink to={ROUTES.booking}>
                <CalendarPlus aria-hidden="true" size={18} />
                Book appointment
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {dayQuery.error ? (
        <ErrorMessage
          title="Couldn't load today's appointments"
          error={dayQuery.error}
          onRetry={() => void dayQuery.refetch()}
          retrying={dayQuery.isRefetching}
        />
      ) : null}

      {dayQuery.isPending ? <StatTilesSkeleton /> : null}

      {summary ? (
        <div className={cn('flex flex-col gap-6', dayQuery.isFetching && 'transition-opacity')}>
          <section aria-label="Today's appointments by status" className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Still to come"
                value={summary.counts.SCHEDULED}
                icon={CalendarClock}
                iconClass="text-carbon"
                caption={
                  next
                    ? `Next at ${next.slotStart}`
                    : summary.late.length > 0
                      ? `${String(summary.late.length)} running late`
                      : 'Nothing left today'
                }
              />
              <StatTile
                label="Waiting"
                value={summary.counts.ARRIVED}
                icon={DoorOpen}
                iconClass="text-saffron"
                caption="Arrived, not seen yet"
              />
              <StatTile
                label="Completed"
                value={summary.counts.COMPLETED}
                icon={CircleCheck}
                iconClass="text-leaf"
                caption="Visits done today"
              />
              <StatTile
                label="Cancelled"
                value={summary.counts.CANCELLED}
                icon={CircleX}
                iconClass="text-vermilion"
                caption="Their slots are free again"
              />
            </div>

            {summary.active > 0 ? (
              <div className="rounded-xl border border-line bg-paper p-4">
                <p className="mb-3 text-sm text-ink">
                  <span className="font-bold">{summary.counts.COMPLETED}</span> of{' '}
                  <span className="font-bold">{summary.active}</span> appointments done
                </p>
                <StatusBar counts={summary.counts} scale={summary.active} />
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                  {STATUS_BAR_SEGMENTS.map((segment) => (
                    <li key={segment.status} className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn('size-2.5 rounded-sm', segment.mark)}
                      />
                      {segment.label}{' '}
                      <span className="font-semibold text-ink tabular-nums">
                        {summary.counts[segment.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {summary.active === 0 && summary.counts.CANCELLED === 0 ? (
            <Panel>
              <EmptyState
                icon={CalendarPlus}
                title={isDoctor ? 'No appointments with you today' : 'No appointments today'}
                description={
                  frontDesk
                    ? 'Open slots are in the scheduler.'
                    : 'Appointments booked with you will appear here.'
                }
                action={
                  frontDesk ? <ButtonLink to={ROUTES.booking}>Book appointment</ButtonLink> : null
                }
              />
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <AppointmentQueue
                title="Waiting now"
                description="Patients who have arrived, in slot order."
                appointments={summary.waiting}
                emptyText="Nobody is waiting."
                showDoctor={!isDoctor}
                onOpen={dialogs.showDetails}
              />
              <AppointmentQueue
                title="Up next"
                description={
                  summary.late.length > 0
                    ? `${String(summary.late.length)} earlier ${summary.late.length === 1 ? 'patient has' : 'patients have'} not arrived yet.`
                    : 'The rest of the day, in slot order.'
                }
                appointments={summary.upcoming}
                emptyText="Nothing else is scheduled today."
                showDoctor={!isDoctor}
                onOpen={dialogs.showDetails}
              />
            </div>
          )}

          {isAdmin ? (
            <DoctorLoadTable
              doctors={doctorsQuery.data ?? []}
              days={summary.doctors}
              date={today}
              loading={doctorsQuery.isPending}
            />
          ) : null}
        </div>
      ) : null}

      <AppointmentDialogsHost dialogs={dialogs} actions={actions} />
    </>
  );
};
