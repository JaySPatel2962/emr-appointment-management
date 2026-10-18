import type { ReactNode } from 'react';

import { Panel } from '@/components/ui/Panel';
import type { AppointmentSummary } from '@/types/models';

export interface AppointmentQueueProps {
  title: string;
  description?: ReactNode;
  appointments: readonly AppointmentSummary[];
  /** Shown when the list is empty. */
  emptyText: string;
  /** Hide the doctor's name, for a doctor's own dashboard. */
  showDoctor: boolean;
  onOpen: (id: string) => void;
  /** How many to show before "and N more". */
  limit?: number | undefined;
}

/** A short list of today's appointments in slot order, each opening its details. */
export const AppointmentQueue = ({
  title,
  description,
  appointments,
  emptyText,
  showDoctor,
  onOpen,
  limit = 6,
}: AppointmentQueueProps) => {
  const shown = appointments.slice(0, limit);
  const more = appointments.length - shown.length;

  return (
    <Panel title={title} description={description} flush>
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((appointment) => (
            <li key={appointment.id}>
              <button
                type="button"
                onClick={() => onOpen(appointment.id)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-canvas"
              >
                <span className="w-12 shrink-0 text-base font-bold text-ink tabular-nums">
                  {appointment.slotStart}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {appointment.patient.name}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {showDoctor ? `${appointment.doctor.name}, ` : ''}
                    {appointment.purpose}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? (
        <p className="border-t border-line px-5 py-2.5 text-xs text-ink-muted">
          and {more} more in the appointment list
        </p>
      ) : null}
    </Panel>
  );
};
