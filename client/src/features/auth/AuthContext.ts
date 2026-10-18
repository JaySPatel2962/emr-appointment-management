import { createContext } from 'react';

import type { LoginCredentials } from '@/features/auth/schemas';
import type { AuthState } from '@/services/auth-session';
import type { User } from '@/types/models';

export interface AuthContextValue extends AuthState {
  signIn: (credentials: LoginCredentials) => Promise<User>;
  signOut: () => Promise<void>;
}

/** The session: who is signed in, with which role. The app's only React context. */
export const AuthContext = createContext<AuthContextValue | null>(null);
