import { CalendarCog } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Table } from '@/components/ui/Table';
import type { TableColumn } from '@/components/ui/Table';
import { useDoctors } from '@/features/doctors/queries';
import { workingDaysLabel } from '@/features/doctors/utils/schedule';
import type { Doctor } from '@/types/models';

export interface DoctorDirectoryProps {
  selectedId: string | null;
  onEdit: (doctorId: string) => void;
}

const rowKey = (doctor: Doctor): string => doctor.id;

/** Every doctor with when they work, and the way into their schedule. */
export const DoctorDirectory = ({ selectedId, onEdit }: DoctorDirectoryProps) => {
  const { data: doctors = [], isPending, error, refetch, isRefetching } = useDoctors();

  const columns = useMemo(
    (): TableColumn<Doctor>[] => [
      {
        id: 'name',
        header: 'Doctor',
        primary: true,
        cell: (doctor) => (
          <div>
            <p className="font-semibold text-ink">{doctor.name}</p>
            <p className="text-xs text-ink-muted">{doctor.specialization}</p>
          </div>
        ),
      },
      { id: 'department', header: 'Department', cell: (doctor) => doctor.department.name },
      {
        id: 'slots',
        header: 'Slot length',
        cell: (doctor) => (
          <span className="tabular-nums">{doctor.slotDurationMinutes} minutes</span>
        ),
      },
      { id: 'days', header: 'Works on', cell: (doctor) => workingDaysLabel(doctor) },
      {
        id: 'edit',
        header: 'Schedule',
        align: 'end',
        hideLabelOnMobile: true,
        cell: (doctor) => (
          <Button
            size="sm"
            variant={doctor.id === selectedId ? 'primary' : 'secondary'}
            aria-label={`Edit ${doctor.name}'s schedule`}
            aria-pressed={doctor.id === selectedId}
            onClick={() => onEdit(doctor.id)}
          >
            <CalendarCog aria-hidden="true" size={15} />
            Edit schedule
          </Button>
        ),
      },
    ],
    [selectedId, onEdit],
  );

  if (error) {
    return (
      <ErrorMessage
        title="Couldn't load the doctors"
        error={error}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    );
  }

  return (
    <Table
      caption="Doctors"
      columns={columns}
      rows={doctors}
      rowKey={rowKey}
      loading={isPending}
      skeletonRows={3}
      empty={
        <p className="px-5 py-6 text-sm text-ink-muted">
          No doctors yet. Add one under "Add a doctor".
        </p>
      }
    />
  );
};
