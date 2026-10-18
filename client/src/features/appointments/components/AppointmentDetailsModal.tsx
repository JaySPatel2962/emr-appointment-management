import { Button } from '@/components/ui/Button';
import { DetailList } from '@/components/ui/DetailList';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { GENDER_LABELS } from '@/constants/patient';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { AppointmentStatusBadge } from '@/features/appointments/components/AppointmentStatusBadge';
import type { AppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import type { EditableAppointment } from '@/features/appointments/hooks/useAppointmentDialogs';
import { useAppointment } from '@/features/appointments/queries';
import { permissionsFor } from '@/features/appointments/utils/permissions';
import { useDepartmentNames } from '@/features/departments/queries';
import { formatMobile } from '@/features/patients/utils/mobile';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { AppointmentDetail, AppointmentSummary } from '@/types/models';
import { ageOn, formatDate, formatDateWithWeekday, formatTimestamp } from '@/utils/date';
import { formatTimeRange } from '@/utils/time';

const Timeline = ({ appointment }: { appointment: AppointmentDetail }) => {
  const events = [
    { label: 'Booked', at: appointment.createdAt },
    { label: 'Arrived', at: appointment.arrivedAt },
    { label: 'Completed', at: appointment.completedAt },
    { label: 'Cancelled', at: appointment.cancelledAt },
  ].filter((event): event is { label: string; at: string } => event.at !== null);

  return (
    <ol className="flex flex-col gap-1">
      {events.map((event) => (
        <li key={event.label} className="text-sm text-ink">
          <span className="font-semibold">{event.label}</span>{' '}
          <span className="text-ink-muted">{formatTimestamp(event.at)}</span>
        </li>
      ))}
    </ol>
  );
};

const Details = ({ appointment }: { appointment: AppointmentDetail }) => {
  const departmentNames = useDepartmentNames();
  const { date: today } = useClinicClock();
  const { patient } = appointment;
  const age = patient.dateOfBirth ? ageOn(patient.dateOfBirth, today) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-ink">{patient.name}</p>
          <p className="text-sm text-ink-muted tabular-nums">
            <span className="whitespace-nowrap">{patient.patientCode}</span>,{' '}
            <span className="whitespace-nowrap">{formatMobile(patient.mobile)}</span>
          </p>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      <DetailList
        items={[
          { label: 'Doctor', value: appointment.doctor.name },
          {
            label: 'Department',
            value: departmentNames.get(appointment.departmentId) ?? 'Unknown department',
          },
          {
            label: 'Patient',
            value: [
              GENDER_LABELS[patient.gender],
              age === null ? null : `${String(age)} years`,
              patient.dateOfBirth ? `born ${formatDate(patient.dateOfBirth)}` : null,
            ]
              .filter(Boolean)
              .join(', '),
          },
          { label: 'History', value: <Timeline appointment={appointment} /> },
          { label: 'Purpose of the visit', value: appointment.purpose, wide: true },
          {
            label: 'Notes',
            value: appointment.notes ? (
              <span className="whitespace-pre-line">{appointment.notes}</span>
            ) : (
              <span className="text-ink-muted">No notes yet</span>
            ),
            wide: true,
          },
        ]}
      />
    </div>
  );
};

const DetailsSkeleton = () => (
  <div className="flex flex-col gap-4" role="status">
    <span className="sr-only">Loading the appointment</span>
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-4 w-36" />
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-10" />
      ))}
    </div>
  </div>
);

export interface AppointmentDetailsModalProps {
  id: string | null;
  actions: AppointmentActions;
  onClose: () => void;
  onEdit: (appointment: EditableAppointment) => void;
  onCancel: (appointment: AppointmentSummary) => void;
}

/** One appointment with the patient's details, its history, and what the user may do next. */
export const AppointmentDetailsModal = ({
  id,
  actions,
  onClose,
  onEdit,
  onCancel,
}: AppointmentDetailsModalProps) => {
  const user = useCurrentUser();
  const { data, isPending, error, refetch, isRefetching } = useAppointment(id);
  const permissions = data ? permissionsFor(user, data) : null;
  const busy = actions.arrive.isPending || actions.complete.isPending;

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      dismissible={!busy}
      size="lg"
      title="Appointment"
      description={
        data
          ? `${formatDateWithWeekday(data.date)}, ${formatTimeRange(data.slotStart, data.slotEnd)}`
          : undefined
      }
      footer={
        data && permissions ? (
          <>
            {permissions.canCancel ? (
              <Button variant="danger-ghost" disabled={busy} onClick={() => onCancel(data)}>
                Cancel appointment
              </Button>
            ) : null}
            {permissions.canEditPurpose || permissions.canEditNotes ? (
              <Button variant="secondary" disabled={busy} onClick={() => onEdit(data)}>
                Edit details
              </Button>
            ) : null}
            {permissions.canArrive ? (
              <Button
                loading={actions.arrive.isPending}
                disabled={busy}
                onClick={() => actions.arrive.mutate(data.id)}
              >
                Mark as arrived
              </Button>
            ) : null}
            {permissions.canComplete ? (
              <Button
                loading={actions.complete.isPending}
                disabled={busy}
                onClick={() => actions.complete.mutate(data.id)}
              >
                Complete visit
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {isPending ? <DetailsSkeleton /> : null}
      {error ? (
        <ErrorMessage
          title="Couldn't load this appointment"
          error={error}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      ) : null}
      {data ? <Details appointment={data} /> : null}
    </Modal>
  );
};
