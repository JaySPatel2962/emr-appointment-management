import { CalendarDays, CalendarPlus, LayoutDashboard, ListChecks, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ROUTE_ACCESS, ROUTES } from '@/constants/routes';
import { ALL_ROLES } from '@/constants/roles';
import type { Role } from '@/constants/roles';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
  /** Only the exact path counts as the current page (so /appointments/new isn't "Appointments"). */
  end: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: ROUTES.dashboard,
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ALL_ROLES,
    end: true,
  },
  {
    to: ROUTES.scheduler,
    label: 'Scheduler',
    icon: CalendarDays,
    roles: ALL_ROLES,
    end: false,
  },
  {
    to: ROUTES.booking,
    label: 'Book appointment',
    icon: CalendarPlus,
    roles: ROUTE_ACCESS.booking,
    end: true,
  },
  {
    to: ROUTES.appointments,
    label: 'Appointments',
    icon: ListChecks,
    roles: ALL_ROLES,
    end: true,
  },
  {
    to: ROUTES.admin,
    label: 'Staff and schedules',
    icon: UsersRound,
    roles: ROUTE_ACCESS.admin,
    end: false,
  },
];

/** The links a role may follow. The router guards the same pages with the same role lists. */
export const navItemsFor = (role: Role): NavItem[] =>
  NAV_ITEMS.filter((item) => item.roles.includes(role));
