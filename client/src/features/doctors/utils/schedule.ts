import { WEEK_ORDER, WEEKDAY_LABELS } from '@/constants/doctor';
import type { DaySchedule, Doctor } from '@/types/models';
import { addDays, dayOfWeek } from '@/utils/date';

type WithSchedule = Pick<Doctor, 'schedule'>;

/** The doctor's sessions and breaks on `date`'s weekday, or undefined on a day off. */
export const dayScheduleOn = (doctor: WithSchedule, date: string): DaySchedule | undefined =>
  doctor.schedule.find((day) => day.dayOfWeek === dayOfWeek(date));

export const worksOn = (doctor: WithSchedule, date: string): boolean =>
  dayScheduleOn(doctor, date) !== undefined;

/** The first day after `date` that the doctor works, looking up to two weeks ahead. */
export const nextWorkingDay = (doctor: WithSchedule, date: string): string | null => {
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDays(date, offset);
    if (worksOn(doctor, candidate)) {
      return candidate;
    }
  }
  return null;
};

/** "Mon, Tue, Wed, Thu, Fri" in the clinic's week order; "No working days" if none. */
export const workingDaysLabel = (doctor: WithSchedule): string => {
  const days = WEEK_ORDER.filter((day) => doctor.schedule.some((entry) => entry.dayOfWeek === day));
  return days.length === 0
    ? 'No working days'
    : days.map((day) => WEEKDAY_LABELS[day].slice(0, 3)).join(', ');
};

/** The weekday's name, for "Dr. Mehta doesn't work on Sundays". */
export const weekdayName = (date: string): string => WEEKDAY_LABELS[dayOfWeek(date)] ?? '';
