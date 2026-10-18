import { APPOINTMENT_STATUS } from '@/constants/appointment';
import type { AppointmentStatus } from '@/constants/appointment';
import type { AppointmentSummary } from '@/types/models';
import type { ClinicMoment } from '@/utils/date';
import { timeToMinutes } from '@/utils/time';

export type StatusCounts = Record<AppointmentStatus, number>;

export interface DoctorDay {
  doctorId: string;
  doctorName: string;
  counts: StatusCounts;
  /** Appointments that still hold a slot: everything but the cancelled ones. */
  active: number;
}

export interface DaySummary {
  counts: StatusCounts;
  active: number;
  /** Arrived and waiting to be seen, in slot order. */
  waiting: AppointmentSummary[];
  /** Scheduled and still to come, in slot order. */
  upcoming: AppointmentSummary[];
  /** Scheduled, but their time has passed and they haven't arrived. */
  late: AppointmentSummary[];
  doctors: DoctorDay[];
}

export const emptyCounts = (): StatusCounts => ({
  [APPOINTMENT_STATUS.SCHEDULED]: 0,
  [APPOINTMENT_STATUS.ARRIVED]: 0,
  [APPOINTMENT_STATUS.COMPLETED]: 0,
  [APPOINTMENT_STATUS.CANCELLED]: 0,
});

const activeOf = (counts: StatusCounts): number =>
  counts.SCHEDULED + counts.ARRIVED + counts.COMPLETED;

const bySlot = (a: AppointmentSummary, b: AppointmentSummary): number =>
  timeToMinutes(a.slotStart) - timeToMinutes(b.slotStart);

/**
 * Today at a glance, from the day's appointments: counts by status, who is waiting, who is
 * next, who is late, and each doctor's load. Pure, so the dashboard's numbers are tested.
 */
export const summarizeDay = (
  appointments: readonly AppointmentSummary[],
  now: ClinicMoment,
): DaySummary => {
  const counts = emptyCounts();
  const doctors = new Map<string, DoctorDay>();

  for (const appointment of appointments) {
    counts[appointment.status] += 1;
    const doctor = doctors.get(appointment.doctor.id) ?? {
      doctorId: appointment.doctor.id,
      doctorName: appointment.doctor.name,
      counts: emptyCounts(),
      active: 0,
    };
    doctor.counts[appointment.status] += 1;
    doctor.active = activeOf(doctor.counts);
    doctors.set(appointment.doctor.id, doctor);
  }

  const sorted = [...appointments].sort(bySlot);
  const scheduled = sorted.filter((item) => item.status === APPOINTMENT_STATUS.SCHEDULED);
  const hasStarted = (item: AppointmentSummary) =>
    item.date < now.date ||
    (item.date === now.date && timeToMinutes(item.slotStart) <= now.minutes);

  return {
    counts,
    active: activeOf(counts),
    waiting: sorted.filter((item) => item.status === APPOINTMENT_STATUS.ARRIVED),
    upcoming: scheduled.filter((item) => !hasStarted(item)),
    late: scheduled.filter(hasStarted),
    doctors: [...doctors.values()].sort((a, b) => a.doctorName.localeCompare(b.doctorName)),
  };
};
