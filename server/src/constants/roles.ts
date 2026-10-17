export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Staff who book, update, cancel and check in appointments and look up patients. */
export const FRONT_DESK_ROLES = [ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST] as const;
