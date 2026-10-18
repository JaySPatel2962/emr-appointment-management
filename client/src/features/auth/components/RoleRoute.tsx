import type { ReactNode } from 'react';

import type { Role } from '@/constants/roles';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage';

export interface RoleRouteProps {
  roles: readonly Role[];
  children: ReactNode;
}

/**
 * Shows its page only to the given roles. Anyone else sees the 403 page at the same address,
 * so the URL still says what they tried to open. The API enforces the same rule on every call.
 */
export const RoleRoute = ({ roles, children }: RoleRouteProps) => {
  const user = useCurrentUser();
  return roles.includes(user.role) ? children : <ForbiddenPage />;
};
