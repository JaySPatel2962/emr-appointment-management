import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NewPatientFields } from '@/features/booking/components/NewPatientFields';
import { EMPTY_BOOKING } from '@/features/booking/schemas';
import type { BookingFormValues } from '@/features/booking/schemas';
import { searchPatients } from '@/features/patients/api';
import { renderWithProviders } from '@/test/render';
import type { Patient } from '@/types/models';

vi.mock('@/features/patients/api', () => ({ searchPatients: vi.fn() }));

const patient = (id: string, name: string): Patient => ({
  id,
  patientCode: `PAT-00000${id}`,
  name,
  mobile: '9876543210',
  gender: 'FEMALE',
  dateOfBirth: null,
});

const ASHA = patient('1', 'Asha Rao');
const LATA = patient('2', 'Lata Rao');

const respondWith = (items: Patient[]) => {
  vi.mocked(searchPatients).mockResolvedValue({
    items,
    meta: { page: 1, limit: 8, total: items.length, totalPages: items.length > 0 ? 1 : 0 },
  });
};

const Harness = ({ onChooseExisting }: { onChooseExisting: (patient: Patient) => void }) => {
  const { register, control, formState } = useForm<BookingFormValues>({
    defaultValues: EMPTY_BOOKING,
  });
  return (
    <NewPatientFields
      register={register}
      errors={formState.errors}
      control={control}
      onChooseExisting={onChooseExisting}
    />
  );
};

const renderFields = () => {
  const onChooseExisting = vi.fn();
  renderWithProviders(<Harness onChooseExisting={onChooseExisting} />);
  return { onChooseExisting, mobile: screen.getByLabelText('Mobile number') };
};

// Found in manual QA (Q-02): the same person could be registered twice without a word.
describe('NewPatientFields: patients who already have the mobile number', () => {
  beforeEach(() => {
    vi.mocked(searchPatients).mockReset();
  });

  it('asks "Is it one of these?" and hands back the patient chosen', async () => {
    respondWith([ASHA]);
    const user = userEvent.setup();
    const { onChooseExisting, mobile } = renderFields();

    await user.type(mobile, '+91 98765-43210');

    expect(await screen.findByText('Is it one of these?')).toBeInTheDocument();
    expect(screen.getByText(/A registered patient has this mobile number/)).toBeInTheDocument();
    expect(searchPatients).toHaveBeenCalledExactlyOnceWith('9876543210', expect.any(AbortSignal));

    await user.click(screen.getByRole('button', { name: 'Choose Asha Rao' }));
    expect(onChooseExisting).toHaveBeenCalledExactlyOnceWith(ASHA);
  });

  it('lists every patient with the number', async () => {
    respondWith([ASHA, LATA]);
    const user = userEvent.setup();
    const { mobile } = renderFields();

    await user.type(mobile, '9876543210');

    expect(await screen.findByText(/2 registered patients have this mobile number/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose Asha Rao' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose Lata Rao' })).toBeVisible();
  });

  it('stays quiet for a number nobody has', async () => {
    respondWith([]);
    const user = userEvent.setup();
    const { mobile } = renderFields();

    await user.type(mobile, '9000012345');

    await waitFor(() => {
      expect(searchPatients).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Is it one of these?')).not.toBeInTheDocument();
  });

  it('does not look up a number that is not complete yet', async () => {
    respondWith([ASHA]);
    const user = userEvent.setup();
    const { mobile } = renderFields();

    await user.type(mobile, '98765');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(searchPatients).not.toHaveBeenCalled();
    expect(screen.queryByText('Is it one of these?')).not.toBeInTheDocument();
  });

  it('drops the hint as soon as the number is changed', async () => {
    respondWith([ASHA]);
    const user = userEvent.setup();
    const { mobile } = renderFields();
    await user.type(mobile, '9876543210');
    await screen.findByText('Is it one of these?');

    await user.type(mobile, '{Backspace}');

    expect(screen.queryByText('Is it one of these?')).not.toBeInTheDocument();
  });
});
