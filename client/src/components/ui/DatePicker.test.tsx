import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from '@/components/ui/DatePicker';

const Harness = ({
  initial,
  onChange,
  isDateDisabled,
}: {
  initial: string;
  onChange: (date: string | null) => void;
  isDateDisabled?: (date: string) => boolean;
}) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <DatePicker
      value={value}
      min="2026-10-10"
      isDateDisabled={isDateDisabled}
      disabledLabel="no sessions"
      onChange={(date) => {
        setValue(date);
        onChange(date);
      }}
    />
  );
};

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Mon, 19 Oct 2026/ }));
  return screen.getByRole('dialog', { name: 'October 2026' });
};

describe('DatePicker', () => {
  it('opens on the chosen date and picks a day with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="2026-10-19" onChange={onChange} />);

    await openPicker(user);
    expect(screen.getByRole('button', { name: 'Monday, 19 October 2026' })).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Tuesday, 27 October 2026' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('2026-10-27');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tue, 27 Oct 2026/ })).toHaveFocus();
  });

  it('pages to the next month with Page Down', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-19" onChange={vi.fn()} />);

    await openPicker(user);
    await user.keyboard('{PageDown}');

    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thursday, 19 November 2026' })).toHaveFocus();
  });

  it("can't pick a day before the minimum or a blocked day, and says why", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const sundays = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
    render(<Harness initial="2026-10-19" onChange={onChange} isDateDisabled={sundays} />);

    await openPicker(user);
    // A day before the minimum is unavailable; only the doctor's days off have no sessions.
    const past = screen.getByRole('button', { name: 'Friday, 9 October 2026, unavailable' });
    const sunday = screen.getByRole('button', { name: 'Sunday, 25 October 2026, no sessions' });
    expect(past).toHaveAttribute('aria-disabled', 'true');

    await user.click(past);
    await user.click(sunday);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('never moves focus before the minimum date', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-12" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Mon, 12 Oct 2026/ }));
    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('button', { name: /Saturday, 10 October 2026/ })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-10-19" onChange={vi.fn()} />);

    await openPicker(user);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mon, 19 Oct 2026/ })).toHaveFocus();
  });
});
