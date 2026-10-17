import type { Types } from 'mongoose';

import { env } from '#app/config/env.js';
import { ACTIVE_APPOINTMENT_STATUSES } from '#app/constants/appointment.js';
import { SLOT_STATUS } from '#app/constants/slot.js';
import type { SlotStatus } from '#app/constants/slot.js';
import { AppointmentModel } from '#app/models/appointment.model.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import type { AuthUser } from '#app/types/auth.js';
import { isDoctor, requireDoctorId } from '#app/utils/access.js';
import { AppError } from '#app/utils/app-error.js';
import { clinicNow } from '#app/utils/clinic-time.js';
import type { ClinicMoment } from '#app/utils/clinic-time.js';
import type { DaySchedule } from '#app/utils/schedule.js';
import { dayOfWeek, minutesToTime, timeToMinutes } from '#app/utils/time.js';
import type { TimeRange } from '#app/utils/time.js';
import type { SlotsQuery } from '#app/validators/slot.validators.js';

/** A bookable slot: [start, end) in "HH:mm". */
export type Slot = TimeRange;

export interface SlotView extends Slot {
  status: SlotStatus;
  appointmentId?: string;
}

export interface DoctorDaySlots {
  doctorId: string;
  date: string;
  timezone: string;
  slotDurationMinutes: number;
  slots: SlotView[];
}

/** The doctor fields that slot generation and booking need. */
export interface SchedulingDoctor {
  _id: Types.ObjectId;
  departmentId: Types.ObjectId;
  name: string;
  slotDurationMinutes: number;
  schedule: readonly DaySchedule[];
}

interface MinuteRange {
  start: number;
  end: number;
}

const toMinuteRange = ({ start, end }: TimeRange): MinuteRange => ({
  start: timeToMinutes(start),
  end: timeToMinutes(end),
});

/** What is left of a range once a break is taken out: nothing, one piece or two. */
const withoutBreak = (range: MinuteRange, pause: MinuteRange): MinuteRange[] => {
  if (pause.end <= range.start || pause.start >= range.end) {
    return [range];
  }
  return [
    ...(pause.start > range.start ? [{ start: range.start, end: pause.start }] : []),
    ...(pause.end < range.end ? [{ start: pause.end, end: range.end }] : []),
  ];
};

const cutIntoSlots = (range: MinuteRange, durationMinutes: number): Slot[] => {
  const slots: Slot[] = [];
  for (let start = range.start; start + durationMinutes <= range.end; start += durationMinutes) {
    slots.push({ start: minutesToTime(start), end: minutesToTime(start + durationMinutes) });
  }
  return slots;
};

/**
 * The bookable slots of one date, from a weekly schedule. Pure: no database and no clock.
 *
 * Takes that weekday's sessions, removes the breaks, and cuts what is left into back-to-back
 * slots of the given length. A slot always fits entirely inside a session and never overlaps a
 * break; a remainder too short for a whole slot is dropped. Slots never overlap, because
 * sessions don't. A weekday that isn't in the schedule has no slots.
 */
export const generateSlots = (
  schedule: readonly DaySchedule[],
  date: string,
  slotDurationMinutes: number,
): Slot[] => {
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
    throw new RangeError('slotDurationMinutes must be a positive whole number');
  }
  const day = schedule.find((entry) => entry.dayOfWeek === dayOfWeek(date));
  if (!day) {
    return [];
  }
  const breaks = day.breaks.map(toMinuteRange);
  return day.sessions
    .map(toMinuteRange)
    .flatMap((session) =>
      breaks.reduce<MinuteRange[]>(
        (free, pause) => free.flatMap((range) => withoutBreak(range, pause)),
        [session],
      ),
    )
    .sort((a, b) => a.start - b.start)
    .flatMap((range) => cutIntoSlots(range, slotDurationMinutes));
};

/** A slot is past once the clinic clock reaches its start: it can no longer be booked. */
export const isPastSlot = (date: string, slot: Slot, now: ClinicMoment): boolean =>
  date < now.date || (date === now.date && timeToMinutes(slot.start) <= now.minutes);

export const findSchedulingDoctor = async (doctorId: string): Promise<SchedulingDoctor> => {
  const doctor = await DoctorModel.findById(doctorId, {
    departmentId: 1,
    name: 1,
    slotDurationMinutes: 1,
    schedule: 1,
  }).lean();
  if (!doctor) {
    throw AppError.notFound('Doctor not found');
  }
  return doctor;
};

/**
 * The slot that starts at `slotStart` on `date`, provided it is in the doctor's schedule and
 * hasn't started yet. Booking goes through this, so it can only book a slot the grid offers.
 */
export const resolveBookableSlot = (
  doctor: SchedulingDoctor,
  date: string,
  slotStart: string,
): Slot => {
  const slot = generateSlots(doctor.schedule, date, doctor.slotDurationMinutes).find(
    (candidate) => candidate.start === slotStart,
  );
  if (!slot) {
    throw AppError.unprocessable("This time is not a slot in the doctor's schedule");
  }
  if (isPastSlot(date, slot, clinicNow())) {
    throw AppError.unprocessable('This slot is in the past');
  }
  return slot;
};

export const getDoctorDaySlots = async (
  query: SlotsQuery,
  actor: AuthUser,
): Promise<DoctorDaySlots> => {
  if (isDoctor(actor) && requireDoctorId(actor) !== query.doctorId) {
    throw AppError.forbidden('Doctors can only view their own slots');
  }
  const now = clinicNow();
  if (query.date < now.date) {
    throw AppError.unprocessable('Slots cannot be shown for a past date');
  }
  const doctor = await findSchedulingDoctor(query.doctorId);
  if (query.departmentId !== undefined && doctor.departmentId.toString() !== query.departmentId) {
    throw AppError.notFound('Doctor not found in this department');
  }

  // One query for the day's active appointments; matching them to slots is a map lookup.
  const appointments = await AppointmentModel.find(
    { doctorId: doctor._id, date: query.date, status: { $in: [...ACTIVE_APPOINTMENT_STATUSES] } },
    { slotStart: 1 },
  ).lean();
  const bookedBySlot = new Map(
    appointments.map((appointment) => [appointment.slotStart, appointment._id.toString()]),
  );

  // BOOKED wins over PAST: a booked slot keeps its appointment id, so a late arrival can be marked.
  const slots = generateSlots(doctor.schedule, query.date, doctor.slotDurationMinutes).map(
    (slot): SlotView => {
      const appointmentId = bookedBySlot.get(slot.start);
      if (appointmentId !== undefined) {
        return { ...slot, status: SLOT_STATUS.BOOKED, appointmentId };
      }
      return {
        ...slot,
        status: isPastSlot(query.date, slot, now) ? SLOT_STATUS.PAST : SLOT_STATUS.AVAILABLE,
      };
    },
  );

  return {
    doctorId: doctor._id.toString(),
    date: query.date,
    timezone: env.CLINIC_TIMEZONE,
    slotDurationMinutes: doctor.slotDurationMinutes,
    slots,
  };
};
