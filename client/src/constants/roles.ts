export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

/** Staff who book, update, cancel and check in appointments and look up patients. */
export const FRONT_DESK_ROLES: readonly Role[] = [ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.DOCTOR]: 'Doctor',
};
