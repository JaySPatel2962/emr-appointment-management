import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { AuthContext } from '@/features/auth/AuthContext';
import type { AuthContextValue } from '@/features/auth/AuthContext';
import { ROLES } from '@/constants/roles';
import type { User } from '@/types/models';

export const RECEPTIONIST: User = {
  id: 'u-rec',
  name: 'Priya Nair',
  email: 'priya.nair@clinic.example',
  role: ROLES.RECEPTIONIST,
};

export const DOCTOR: User = {
  id: 'u-doc',
  name: 'Dr. Kavya Mehta',
  email: 'kavya.mehta@clinic.example',
  role: ROLES.DOCTOR,
  doctorId: '6ad4b1a4c42b65083c36c4e6',
};

export const authValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  status: 'authenticated',
  user: RECEPTIONIST,
  endReason: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  ...overrides,
});

interface RenderOptions {
  auth?: AuthContextValue;
  route?: string;
}

/** Renders `ui` with a fresh query client, an auth context and a router, as the app does. */
export const renderWithProviders = (
  ui: ReactElement,
  { auth = authValue(), route = '/' }: RenderOptions = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext>
    </QueryClientProvider>,
  );
};
