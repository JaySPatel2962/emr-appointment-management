import { describe, expect, it } from 'vitest';

import { redirectTarget } from '@/features/auth/utils/redirect';

describe('redirectTarget', () => {
  it('goes back to the page that sent the user to log in, with its query', () => {
    expect(redirectTarget({ from: { pathname: '/appointments', search: '?status=ARRIVED' } })).toBe(
      '/appointments?status=ARRIVED',
    );
  });

  it('defaults to the dashboard', () => {
    expect(redirectTarget(undefined)).toBe('/');
    expect(redirectTarget({ from: 'nowhere' })).toBe('/');
  });

  it('never redirects to another site or back to the login page', () => {
    expect(redirectTarget({ from: { pathname: 'https://evil.example', search: '' } })).toBe('/');
    expect(redirectTarget({ from: { pathname: '/login', search: '' } })).toBe('/');
  });
});
