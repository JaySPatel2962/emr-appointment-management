import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ROLES } from '@/constants/roles';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { RoleRoute } from '@/features/auth/components/RoleRoute';
import { authValue, DOCTOR, renderWithProviders } from '@/test/render';

/** Stands in for the login page and shows where it would send the user back to. */
const LoginProbe = () => {
  const location = useLocation();
  const state: unknown = location.state;
  return <p>Login page, from {JSON.stringify(state)}</p>;
};

const app = (
  <Routes>
    <Route path="/login" element={<LoginProbe />} />
    <Route
      path="/appointments"
      element={
        <ProtectedRoute>
          <p>Appointments page</p>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <ProtectedRoute>
          <RoleRoute roles={[ROLES.SUPER_ADMIN]}>
            <p>Admin page</p>
          </RoleRoute>
        </ProtectedRoute>
      }
    />
  </Routes>
);

describe('ProtectedRoute', () => {
  it('waits for the silent refresh before deciding', () => {
    renderWithProviders(app, {
      route: '/appointments',
      auth: authValue({ status: 'checking', user: null }),
    });

    expect(screen.getByText('Checking your session')).toBeInTheDocument();
    expect(screen.queryByText('Appointments page')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page, remembering where they were going', () => {
    renderWithProviders(app, {
      route: '/appointments?status=ARRIVED',
      auth: authValue({ status: 'anonymous', user: null }),
    });

    expect(screen.getByText(/Login page/)).toHaveTextContent(
      'from {"from":{"pathname":"/appointments","search":"?status=ARRIVED"}}',
    );
  });

  it('shows the page to a signed-in user', () => {
    renderWithProviders(app, { route: '/appointments' });

    expect(screen.getByText('Appointments page')).toBeInTheDocument();
  });
});

describe('RoleRoute', () => {
  it('shows the 403 page, at the same address, to a role that may not see it', () => {
    renderWithProviders(app, { route: '/admin', auth: authValue({ user: DOCTOR }) });

    expect(
      screen.getByRole('heading', { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your role \(Doctor\)/)).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  it('shows the page to an allowed role', () => {
    renderWithProviders(app, {
      route: '/admin',
      auth: authValue({ user: { ...DOCTOR, role: ROLES.SUPER_ADMIN } }),
    });

    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });
});
