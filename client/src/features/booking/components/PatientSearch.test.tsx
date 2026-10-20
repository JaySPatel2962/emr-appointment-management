import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientSearch } from '@/features/booking/components/PatientSearch';
import { searchPatients } from '@/features/patients/api';
import { renderWithProviders } from '@/test/render';
import type { Patient } from '@/types/models';

vi.mock('@/features/patients/api', () => ({ searchPatients: vi.fn() }));

const ASHA: Patient = {
  id: 'p-1',
  patientCode: 'PAT-000001',
  name: 'Asha Rao',
  mobile: '9876543210',
  gender: 'FEMALE',
  dateOfBirth: null,
};

const renderSearch = () =>
  renderWithProviders(<PatientSearch selected={null} onSelect={vi.fn()} onRegister={vi.fn()} />);

describe('PatientSearch', () => {
  beforeEach(() => {
    vi.mocked(searchPatients)
      .mockReset()
      .mockResolvedValue({
        items: [ASHA],
        meta: { page: 1, limit: 8, total: 1, totalPages: 1 },
      });
  });

  it('lists the patients that match what is typed', async () => {
    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByLabelText('Find the patient'), 'Asha');

    expect(await screen.findByRole('radio', { name: /Asha Rao/ })).toBeInTheDocument();
    expect(searchPatients).toHaveBeenCalledWith('Asha', expect.any(AbortSignal));
  });

  // Found in manual QA: the last results stayed on screen, and could be picked, after the box
  // was cut back to one character or emptied.
  it.each([
    ['cut back to one character', 'A'],
    ['emptied', ''],
  ])('drops the results when the box is %s', async (_label, text) => {
    const user = userEvent.setup();
    renderSearch();
    const box = screen.getByLabelText('Find the patient');
    await user.type(box, 'Asha');
    await screen.findByRole('radio', { name: /Asha Rao/ });

    await user.clear(box);
    if (text !== '') {
      await user.type(box, text);
    }

    await waitFor(() => {
      expect(screen.queryByRole('radio', { name: /Asha Rao/ })).not.toBeInTheDocument();
    });
    expect(searchPatients).toHaveBeenCalledTimes(1);
  });
});
