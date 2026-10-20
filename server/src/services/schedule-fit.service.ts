import type { Types } from 'mongoose';

import { APPOINTMENT_STATUS } from '#app/constants/appointment.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { generateSlots } from '#app/services/slot.service.js';
import { AppError } from '#app/utils/app-error.js';
import { clinicNow } from '#app/utils/clinic-time.js';
import type { DaySchedule } from '#app/utils/schedule.js';

/** An appointment still to happen that a proposed schedule would leave without its slot. */
export interface StrandedAppointment {
  id: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  status: string;
  patient: { id: string; patientCode: string; name: string };
}

// Appointments still to happen: completed and cancelled ones hold nothing a schedule must keep.
const STILL_TO_HAPPEN = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.ARRIVED];

/**
 * The doctor's SCHEDULED or ARRIVED appointments, dated today or later, that the proposed
 * schedule would strand: no slot of the new grid on their date has the same start and end.
 * One query, answered by the { doctorId, date } index.
 */
export const findStrandedAppointments = async (
  doctorId: Types.ObjectId,
  schedule: readonly DaySchedule[],
  slotDurationMinutes: number,
): Promise<StrandedAppointment[]> => {
  const appointments = await AppointmentModel.find(
    { doctorId, date: { $gte: clinicNow().date }, status: { $in: STILL_TO_HAPPEN } },
    { date: 1, slotStart: 1, slotEnd: 1, status: 1, patientId: 1, patientCode: 1, patientName: 1 },
  )
    .sort({ date: 1, slotStart: 1 })
    .lean();

  const gridByDate = new Map<string, Set<string>>();
  const fitsGrid = (date: string, start: string, end: string): boolean => {
    let grid = gridByDate.get(date);
    if (!grid) {
      grid = new Set(
        generateSlots(schedule, date, slotDurationMinutes).map(
          (slot) => `${slot.start}-${slot.end}`,
        ),
      );
      gridByDate.set(date, grid);
    }
    return grid.has(`${start}-${end}`);
  };

  return appointments
    .filter(
      (appointment) => !fitsGrid(appointment.date, appointment.slotStart, appointment.slotEnd),
    )
    .map((appointment) => ({
      id: appointment._id.toString(),
      date: appointment.date,
      slotStart: appointment.slotStart,
      slotEnd: appointment.slotEnd,
      status: appointment.status,
      patient: {
        id: appointment.patientId.toString(),
        patientCode: appointment.patientCode,
        name: appointment.patientName,
      },
    }));
};

/** The 409 that refuses a schedule change, listing the appointments it would strand. */
export const strandedAppointmentsError = (stranded: readonly StrandedAppointment[]): AppError =>
  AppError.conflict(
    stranded.length === 1
      ? 'This schedule would leave 1 booked appointment without its slot'
      : `This schedule would leave ${String(stranded.length)} booked appointments without their slots`,
    { appointments: stranded },
  );
