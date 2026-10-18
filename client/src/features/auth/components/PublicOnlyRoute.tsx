import { Navigate, useLocation } from 'react-router';
import type { Location } from 'react-router';
import type { ReactNode } from 'react';

import { PageLoader } from '@/components/feedback/PageLoader';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { redirectTarget } from '@/features/auth/utils/redirect';

export interface PublicOnlyRouteProps {
  children: ReactNode;
}

/** The login page: a signed-in user is sent on to where they were going instead. */
export const PublicOnlyRoute = ({ children }: PublicOnlyRouteProps) => {
  const { status } = useAuth();
  // Router state is whatever the previous page put there, so it's read as unknown and checked.
  const location: Location<unknown> = useLocation();

  if (status === 'checking') {
    return <PageLoader fullScreen label="Checking your session" />;
  }
  if (status === 'authenticated') {
    return <Navigate to={redirectTarget(location.state)} replace />;
  }
  return children;
};
