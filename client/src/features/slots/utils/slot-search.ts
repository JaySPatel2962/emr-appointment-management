import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import type { User } from '@/types/models';
import { isValidDate } from '@/utils/date';
import { isValidTime } from '@/utils/time';

// The scheduler and the booking page keep their doctor, department, date (and slot) in the
// URL: a reload keeps them, and a slot in the scheduler links straight to its booking.

export interface SlotSearch {
  doctorId: string | null;
  departmentId: string | null;
  date: string;
  slot: string | null;
}

const PARAM = {
  doctorId: 'doctor',
  departmentId: 'department',
  date: 'date',
  slot: 'slot',
} as const;

const OBJECT_ID = /^[a-f\d]{24}$/i;

const validId = (value: string | null): string | null =>
  value !== null && OBJECT_ID.test(value) ? value : null;

/**
 * Reads the selection from the URL. A doctor always sees their own day, whatever the URL says.
 * A missing, invalid or past date means today: slots can't be shown for a past date.
 */
export const readSlotSearch = (search: URLSearchParams, today: string, user: User): SlotSearch => {
  const date = search.get(PARAM.date);
  const slot = search.get(PARAM.slot);
  const isDoctor = user.role === ROLES.DOCTOR;
  return {
    doctorId: isDoctor ? (user.doctorId ?? null) : validId(search.get(PARAM.doctorId)),
    departmentId: isDoctor ? null : validId(search.get(PARAM.departmentId)),
    date: date !== null && isValidDate(date) && date >= today ? date : today,
    slot: slot !== null && isValidTime(slot) ? slot : null,
  };
};

/** The URL query with `patch` applied; null removes a value. */
export const writeSlotSearch = (
  current: URLSearchParams,
  patch: Partial<SlotSearch>,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch) as [keyof SlotSearch, string | null][]) {
    if (value === null) {
      next.delete(PARAM[key]);
    } else {
      next.set(PARAM[key], value);
    }
  }
  return next;
};

/** The booking page for one slot, with the doctor, date and time filled in. */
export const bookingLink = ({ doctorId, departmentId, date, slot }: SlotSearch): string => {
  const search = writeSlotSearch(new URLSearchParams(), { doctorId, departmentId, date, slot });
  return `${ROUTES.booking}?${search.toString()}`;
};

/** The scheduler showing one doctor's day. */
export const schedulerLink = (doctorId: string, date: string): string =>
  `${ROUTES.scheduler}?${writeSlotSearch(new URLSearchParams(), { doctorId, date }).toString()}`;
