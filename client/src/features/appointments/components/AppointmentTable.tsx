import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { Table } from '@/components/ui/Table';
import type { SortState, TableColumn } from '@/components/ui/Table';
import type { AppointmentSortField } from '@/constants/appointment';
import { ROLES } from '@/constants/roles';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { AppointmentRowActions } from '@/features/appointments/components/AppointmentRowActions';
import type { RowActionHandlers } from '@/features/appointments/components/AppointmentRowActions';
import { AppointmentStatusBadge } from '@/features/appointments/components/AppointmentStatusBadge';
import { permissionsFor } from '@/features/appointments/utils/permissions';
import { useDepartmentNames } from '@/features/departments/queries';
import { formatMobile } from '@/features/patients/utils/mobile';
import type { Appointment } from '@/types/models';
import { formatDateWithWeekday, formatTimestamp } from '@/utils/date';
import { formatTimeRange } from '@/utils/time';

export interface AppointmentTableProps extends RowActionHandlers {
  appointments: readonly Appointment[];
  sort: SortState<AppointmentSortField>;
  onSortChange: (by: AppointmentSortField) => void;
  onOpen: (id: string) => void;
  loading: boolean;
  refreshing: boolean;
  empty: ReactNode;
}

const rowKey = (appointment: Appointment): string => appointment.id;

export const AppointmentTable = ({
  appointments,
  sort,
  onSortChange,
  onOpen,
  onArrive,
  onComplete,
  onEdit,
  onCancel,
  loading,
  refreshing,
  empty,
}: AppointmentTableProps) => {
  const user = useCurrentUser();
  const departmentNames = useDepartmentNames();

  // Stable columns (and stable handlers from the page) let unchanged rows skip re-rendering.
  const columns = useMemo((): TableColumn<Appointment, AppointmentSortField>[] => {
    const doctorColumn: TableColumn<Appointment, AppointmentSortField> = {
      id: 'doctor',
      header: 'Doctor',
      sortKey: 'doctorName',
      cell: (appointment) => (
        <div className="@max-3xl:text-right">
          <p>{appointment.doctor.name}</p>
          <p className="text-xs text-ink-muted">
            {departmentNames.get(appointment.departmentId) ?? ''}
          </p>
        </div>
      ),
    };

    return [
      {
        id: 'when',
        header: 'Date and time',
        sortKey: 'date',
        className: '@3xl:w-40',
        cell: (appointment) => (
          <div className="tabular-nums @max-3xl:text-right">
            <p className="font-semibold">{formatDateWithWeekday(appointment.date)}</p>
            <p className="text-ink-muted">
              {formatTimeRange(appointment.slotStart, appointment.slotEnd)}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        sortKey: 'patientName',
        primary: true,
        cell: (appointment) => (
          <div>
            <button
              type="button"
              onClick={() => onOpen(appointment.id)}
              className="text-left font-semibold text-carbon underline-offset-2 hover:underline"
            >
              {appointment.patient.name}
            </button>
            <p className="text-xs text-ink-muted tabular-nums">
              <span className="whitespace-nowrap">{appointment.patient.patientCode}</span>,{' '}
              <span className="whitespace-nowrap">{formatMobile(appointment.patient.mobile)}</span>
            </p>
          </div>
        ),
      },
      ...(user.role === ROLES.DOCTOR ? [] : [doctorColumn]),
      {
        id: 'purpose',
        header: 'Purpose',
        cell: (appointment) => (
          <p className="line-clamp-2 max-w-60 @max-3xl:text-right">{appointment.purpose}</p>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: (appointment) => <AppointmentStatusBadge status={appointment.status} />,
      },
      {
        id: 'booked',
        header: 'Booked',
        sortKey: 'createdAt',
        visibleFrom: 'xl',
        cell: (appointment) => (
          <span className="whitespace-nowrap text-ink-muted tabular-nums">
            {formatTimestamp(appointment.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        align: 'end',
        hideLabelOnMobile: true,
        cell: (appointment) => (
          <AppointmentRowActions
            appointment={appointment}
            permissions={permissionsFor(user, appointment)}
            onArrive={onArrive}
            onComplete={onComplete}
            onEdit={onEdit}
            onCancel={onCancel}
          />
        ),
      },
    ];
  }, [user, departmentNames, onOpen, onArrive, onComplete, onEdit, onCancel]);

  return (
    <Table
      caption="Appointments"
      columns={columns}
      rows={appointments}
      rowKey={rowKey}
      sort={sort}
      onSortChange={onSortChange}
      loading={loading}
      refreshing={refreshing}
      empty={empty}
    />
  );
};
