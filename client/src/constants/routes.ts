import { FRONT_DESK_ROLES, ROLES } from '@/constants/roles';
import type { Role } from '@/constants/roles';

export const ROUTES = {
  login: '/login',
  dashboard: '/',
  scheduler: '/scheduler',
  appointments: '/appointments',
  booking: '/appointments/new',
  admin: '/admin',
} as const;

/** Pages limited to some roles. The router guards them and the navigation hides them. */
export const ROUTE_ACCESS = {
  booking: FRONT_DESK_ROLES,
  admin: [ROLES.SUPER_ADMIN],
} as const satisfies Readonly<Record<string, readonly Role[]>>;
