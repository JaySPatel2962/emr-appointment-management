import { Navigate, useLocation } from 'react-router';
import type { ReactNode } from 'react';

import { PageLoader } from '@/components/feedback/PageLoader';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { LoginRedirectState } from '@/features/auth/utils/redirect';

export interface ProtectedRouteProps {
  children: ReactNode;
}

/** Only signed-in users get past it; everyone else goes to the login page and comes back after. */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { status } = useAuth();
  const { pathname, search } = useLocation();

  if (status === 'checking') {
    return <PageLoader fullScreen label="Checking your session" />;
  }
  if (status === 'anonymous') {
    const state: LoginRedirectState = { from: { pathname, search } };
    return <Navigate to={ROUTES.login} replace state={state} />;
  }
  return children;
};
