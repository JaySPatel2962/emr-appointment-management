import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { AuthContext } from '@/features/auth/AuthContext';
import type { AuthContextValue } from '@/features/auth/AuthContext';
import { restoreSession, signIn, signOut } from '@/features/auth/session';
import { authSession } from '@/services/auth-session';

export interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const state = useSyncExternalStore(authSession.subscribe, authSession.getState);
  const queryClient = useQueryClient();

  // Once per page load. Concurrent refreshes share one request, so StrictMode's second call is safe.
  useEffect(() => {
    void restoreSession();
  }, []);

  // When a session ends, no cached patient or appointment data stays in memory. (The socket
  // service closes its own connection.)
  useEffect(() => {
    if (state.status === 'anonymous') {
      queryClient.clear();
    }
  }, [state.status, queryClient]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, signIn, signOut }), [state]);

  return <AuthContext value={value}>{children}</AuthContext>;
};
