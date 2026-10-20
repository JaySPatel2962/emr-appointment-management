import { Link } from 'react-router';

import { Alert } from '@/components/ui/Alert';
import { appointmentListLink } from '@/features/admin/utils/stranded';
import type { StrandedAppointment } from '@/features/admin/utils/stranded';
import { formatDateWithWeekday } from '@/utils/date';

export interface StrandedAppointmentsAlertProps {
  doctorName: string;
  appointments: readonly StrandedAppointment[];
}

/** Why a schedule wasn't saved: the booked appointments it would have left without a slot. */
export const StrandedAppointmentsAlert = ({
  doctorName,
  appointments,
}: StrandedAppointmentsAlertProps) => (
  <Alert
    tone="error"
    title={
      appointments.length === 1
        ? 'Not saved: 1 booked appointment would lose its slot'
        : `Not saved: ${String(appointments.length)} booked appointments would lose their slots`
    }
  >
    <p>Cancel or rebook these first, or keep their times in the schedule, then save again.</p>
    <ul className="mt-2 flex flex-col gap-1">
      {appointments.map((appointment) => (
        <li key={appointment.id}>
          <Link
            to={appointmentListLink(doctorName, appointment.date)}
            className="font-semibold text-carbon underline-offset-2 hover:underline"
          >
            {formatDateWithWeekday(appointment.date)}, {appointment.slotStart}–{appointment.slotEnd}
          </Link>
          : {appointment.patient.name} ({appointment.patient.patientCode})
        </li>
      ))}
    </ul>
  </Alert>
);
