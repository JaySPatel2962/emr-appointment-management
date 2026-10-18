import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/LoginForm';
import { ApiError } from '@/services/api-error';
import { authValue, renderWithProviders } from '@/test/render';
import type { User } from '@/types/models';

const renderForm = (signIn: (credentials: { email: string; password: string }) => Promise<User>) =>
  renderWithProviders(<LoginForm />, {
    auth: authValue({ status: 'anonymous', user: null, signIn }),
  });

describe('LoginForm', () => {
  it('asks for both fields before contacting the server', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn();
    renderForm(signIn);

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects an email address that is not one', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn());

    await user.type(screen.getByLabelText('Email'), 'priya@');
    await user.type(screen.getByLabelText('Password'), 'Welcome123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/Enter a valid email address/)).toBeInTheDocument();
  });

  it('signs in with the trimmed email, showing progress meanwhile', async () => {
    const user = userEvent.setup();
    let finish: (user: User) => void = () => undefined;
    const signIn = vi.fn(
      () =>
        new Promise<User>((resolve) => {
          finish = resolve;
        }),
    );
    renderForm(signIn);

    await user.type(screen.getByLabelText('Email'), '  priya.nair@clinic.example ');
    await user.type(screen.getByLabelText('Password'), 'Welcome123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        { email: 'priya.nair@clinic.example', password: 'Welcome123' },
        expect.anything(),
      );
    });
    expect(screen.getByRole('button', { name: 'Log in' })).toHaveAttribute('aria-busy', 'true');
    finish({
      id: 'u1',
      name: 'Priya Nair',
      email: 'priya.nair@clinic.example',
      role: 'RECEPTIONIST',
    });
  });

  it("shows the server's answer and clears the password after a failed login", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn(() =>
      Promise.reject(new ApiError('Invalid email or password', { status: 401 })),
    );
    renderForm(signIn);

    await user.type(screen.getByLabelText('Email'), 'priya.nair@clinic.example');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('explains the login rate limit in plain words', async () => {
    const user = userEvent.setup();
    renderForm(() => Promise.reject(new ApiError('Too many requests', { status: 429 })));

    await user.type(screen.getByLabelText('Email'), 'priya.nair@clinic.example');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Wait 15 minutes/);
  });
});
