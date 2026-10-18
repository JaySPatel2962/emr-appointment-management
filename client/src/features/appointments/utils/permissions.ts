import {
  APPOINTMENT_STATUS,
  CANCELLABLE_STATUSES,
  NOTES_EDITABLE_STATUSES,
  PURPOSE_EDITABLE_STATUSES,
} from '@/constants/appointment';
import { FRONT_DESK_ROLES, ROLES } from '@/constants/roles';
import type { AppointmentSummary, User } from '@/types/models';

export interface AppointmentPermissions {
  canEditPurpose: boolean;
  canEditNotes: boolean;
  canArrive: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

/**
 * What `user` may do to `appointment` now, from their role and its status. The API enforces the
 * same rules; the UI uses them to offer only the actions that would succeed.
 * - Front desk (Super Admin, Receptionist): edit purpose and notes, check in, cancel.
 * - Doctor, on their own appointments only: edit notes, complete an arrived visit.
 * - Super Admin can also complete a visit.
 */
export const permissionsFor = (
  user: User,
  appointment: Pick<AppointmentSummary, 'status' | 'doctor'>,
): AppointmentPermissions => {
  const frontDesk = FRONT_DESK_ROLES.includes(user.role);
  const ownDoctor = user.role === ROLES.DOCTOR && user.doctorId === appointment.doctor.id;
  const { status } = appointment;

  return {
    canEditPurpose: frontDesk && PURPOSE_EDITABLE_STATUSES.includes(status),
    canEditNotes: (frontDesk || ownDoctor) && NOTES_EDITABLE_STATUSES.includes(status),
    canArrive: frontDesk && status === APPOINTMENT_STATUS.SCHEDULED,
    canComplete:
      (user.role === ROLES.SUPER_ADMIN || ownDoctor) && status === APPOINTMENT_STATUS.ARRIVED,
    canCancel: frontDesk && CANCELLABLE_STATUSES.includes(status),
  };
};
