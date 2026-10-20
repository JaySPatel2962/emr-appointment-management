import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFLICT_CODES } from '@/constants/conflicts';
import { EditSchedulePanel } from '@/features/admin/components/EditSchedulePanel';
import { getDoctor, updateSchedule } from '@/features/doctors/api';
import { ApiError } from '@/services/api-error';
import { renderWithProviders } from '@/test/render';
import type { Doctor } from '@/types/models';

vi.mock('@/features/doctors/api', () => ({ getDoctor: vi.fn(), updateSchedule: vi.fn() }));

const STALE = 'The schedule changed since you opened it. Reload to see the latest.';

const doctorAt = (scheduleVersion: number, slotDurationMinutes: number): Doctor => ({
  id: 'd-1',
  userId: 'u-1',
  name: 'Dr. Rohan Das',
  specialization: 'Sports injuries',
  department: { id: 'dep-1', name: 'Orthopedics' },
  slotDurationMinutes,
  schedule: [{ dayOfWeek: 1, sessions: [{ start: '09:00', end: '13:00' }], breaks: [] }],
  scheduleVersion,
});

const staleError = (currentVersion: number) =>
  new ApiError(STALE, {
    status: 409,
    meta: { code: CONFLICT_CODES.SCHEDULE_STALE, scheduleVersion: currentVersion },
  });

const sentVersions = () =>
  vi.mocked(updateSchedule).mock.calls.map(([, body]) => body.scheduleVersion);

// Found in the manual retest (R2-01l, Q-08): of two admins editing the same week, the later
// save silently undid the earlier one.
describe('EditSchedulePanel: someone else saved the schedule first', () => {
  beforeEach(() => {
    vi.mocked(updateSchedule).mockReset();
    vi.mocked(getDoctor).mockReset();
  });

  it('sends the version it loaded, and the saved one after a save', async () => {
    vi.mocked(updateSchedule).mockResolvedValue(doctorAt(4, 20));
    const user = userEvent.setup();
    renderWithProviders(<EditSchedulePanel doctor={doctorAt(3, 15)} />);

    await user.selectOptions(screen.getByLabelText('Slot length'), '20');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));
    await user.selectOptions(await screen.findByLabelText('Slot length'), '30');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));

    expect(sentVersions()).toEqual([3, 4]);
  });

  it('says so above the Save button, and reloads the saved schedule only when asked', async () => {
    vi.mocked(updateSchedule).mockRejectedValueOnce(staleError(4));
    vi.mocked(getDoctor).mockResolvedValue(doctorAt(4, 30));
    const user = userEvent.setup();
    renderWithProviders(<EditSchedulePanel doctor={doctorAt(3, 15)} />);
    const slotLength = screen.getByLabelText('Slot length');

    await user.selectOptions(slotLength, '20');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(STALE);
    expect(alert).toHaveTextContent('drops the changes made here');
    // Nothing is replaced until the user chooses to reload.
    expect(slotLength).toHaveValue('20');
    expect(getDoctor).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reload schedule' }));

    expect(await screen.findByLabelText('Slot length')).toHaveValue('30');
    expect(screen.queryByText(STALE)).not.toBeInTheDocument();
    // Focus moves once the reloaded form has rendered.
    await waitFor(() => {
      expect(screen.getByLabelText('Slot length')).toHaveFocus();
    });

    vi.mocked(updateSchedule).mockResolvedValue(doctorAt(5, 20));
    await user.selectOptions(screen.getByLabelText('Slot length'), '20');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(sentVersions()).toEqual([3, 4]);
  });
});
