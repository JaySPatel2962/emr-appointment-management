import { use } from 'react';

import { AuthContext } from '@/features/auth/AuthContext';
import type { AuthContextValue } from '@/features/auth/AuthContext';
import type { User } from '@/types/models';

export const useAuth = (): AuthContextValue => {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
};

/** The signed-in user, for screens behind <ProtectedRoute>, where there always is one. */
export const useCurrentUser = (): User => {
  const { user } = useAuth();
  if (!user) {
    throw new Error('useCurrentUser must be used behind <ProtectedRoute>');
  }
  return user;
};
