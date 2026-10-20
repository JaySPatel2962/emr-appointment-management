import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';

const chunkError = new TypeError(
  'Failed to fetch dynamically imported module: http://localhost:5173/assets/SchedulerPage.js',
);

const renderFallback = (error: Error) => render(<ErrorFallback error={error} reset={vi.fn()} />);

describe('ErrorFallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers a reload when a page's code is missing after an update", () => {
    renderFallback(chunkError);

    expect(screen.getByRole('heading', { name: 'A newer version is available' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeVisible();
  });

  // Found in manual QA: offline, the same error claimed the app had been updated.
  it("says the device is offline when that is why the code didn't load", () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    renderFallback(chunkError);

    expect(screen.getByRole('heading', { name: "You're offline" })).toBeVisible();
    expect(screen.getByText(/Reconnect, then reload the page/)).toBeVisible();
    expect(screen.queryByText(/updated/)).not.toBeInTheDocument();
  });

  it('offers to try again after any other error', () => {
    renderFallback(new Error('Cannot read properties of undefined'));

    expect(screen.getByRole('heading', { name: "This page didn't load" })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
