import { useMemo } from 'react';
import { Link } from 'react-router';

import { Panel } from '@/components/ui/Panel';
import { Table } from '@/components/ui/Table';
import type { TableColumn } from '@/components/ui/Table';
import { StatusBar } from '@/features/dashboard/components/StatusBar';
import { emptyCounts } from '@/features/dashboard/utils/summary';
import type { DoctorDay } from '@/features/dashboard/utils/summary';
import { schedulerLink } from '@/features/slots/utils/slot-search';
import type { Doctor } from '@/types/models';

interface DoctorRow extends DoctorDay {
  departmentName: string;
}

export interface DoctorLoadTableProps {
  doctors: readonly Doctor[];
  days: readonly DoctorDay[];
  date: string;
  loading: boolean;
}

const count = (value: number) => <span className="tabular-nums">{value}</span>;

/**
 * Each doctor's day: the numbers by status, and a bar of the active load scaled to the
 * busiest doctor, so the bars compare at a glance. Every doctor is listed, even with nothing
 * booked; the table is also the chart's text equivalent.
 */
export const DoctorLoadTable = ({ doctors, days, date, loading }: DoctorLoadTableProps) => {
  const rows = useMemo((): DoctorRow[] => {
    const byDoctor = new Map(days.map((day) => [day.doctorId, day]));
    return doctors.map((doctor) => ({
      doctorId: doctor.id,
      doctorName: doctor.name,
      departmentName: doctor.department.name,
      counts: byDoctor.get(doctor.id)?.counts ?? emptyCounts(),
      active: byDoctor.get(doctor.id)?.active ?? 0,
    }));
  }, [doctors, days]);

  const busiest = Math.max(1, ...rows.map((row) => row.active));

  const columns = useMemo(
    (): TableColumn<DoctorRow>[] => [
      {
        id: 'doctor',
        header: 'Doctor',
        primary: true,
        cell: (row) => (
          <div>
            <Link
              to={schedulerLink(row.doctorId, date)}
              className="font-semibold text-carbon underline-offset-2 hover:underline"
            >
              {row.doctorName}
            </Link>
            <p className="text-xs text-ink-muted">{row.departmentName}</p>
          </div>
        ),
      },
      {
        id: 'load',
        header: 'Load',
        className: '@3xl:w-[34%]',
        cell: (row) => (
          <div className="w-full @max-3xl:max-w-40">
            <StatusBar counts={row.counts} scale={busiest} size="sm" />
          </div>
        ),
      },
      {
        id: 'completed',
        header: 'Completed',
        align: 'end',
        cell: (row) => count(row.counts.COMPLETED),
      },
      { id: 'waiting', header: 'Waiting', align: 'end', cell: (row) => count(row.counts.ARRIVED) },
      {
        id: 'scheduled',
        header: 'To come',
        align: 'end',
        cell: (row) => count(row.counts.SCHEDULED),
      },
      {
        id: 'cancelled',
        header: 'Cancelled',
        align: 'end',
        cell: (row) => count(row.counts.CANCELLED),
      },
    ],
    [busiest, date],
  );

  return (
    <Panel
      title="By doctor"
      description="Today's appointments for each doctor. Open a doctor to see their day."
      flush
    >
      <div className="-m-px">
        <Table
          caption="Today's appointments by doctor"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.doctorId}
          loading={loading}
          skeletonRows={3}
          empty={<p className="px-5 py-6 text-sm text-ink-muted">No doctors yet.</p>}
        />
      </div>
    </Panel>
  );
};
