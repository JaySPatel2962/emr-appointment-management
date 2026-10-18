import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SlotGrid } from '@/features/slots/components/SlotGrid';
import type { SlotGridProps } from '@/features/slots/components/SlotGrid';
import { applyToSlots } from '@/features/slots/utils/live-slots';
import type { AppointmentSummary, DaySchedule, Slot } from '@/types/models';
import { cn } from '@/utils/cn';
import { minutesToTime, timeToMinutes } from '@/utils/time';

// Every tile calls cn() while it renders, so counting the calls counts the tiles that rendered.
vi.mock('@/utils/cn', async (importOriginal) => {
  const actual = await importOriginal<{ cn: typeof cn }>();
  return { cn: vi.fn(actual.cn) };
});

const DATE = '2099-01-05'; // a Monday far ahead: no slot is past by the clock

const DAY: DaySchedule = {
  dayOfWeek: 1,
  sessions: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '15:00' },
  ],
  breaks: [
    { start: '10:00', end: '10:30' },
    { start: '12:00', end: '13:00' },
  ],
};

/** Back-to-back 15-minute slots in a range, all AVAILABLE. */
const slotsBetween = (start: string, end: string): Slot[] =>
  Array.from({ length: (timeToMinutes(end) - timeToMinutes(start)) / 15 }, (_, index) => {
    const from = timeToMinutes(start) + index * 15;
    return { start: minutesToTime(from), end: minutesToTime(from + 15), status: 'AVAILABLE' };
  });

const SLOTS: Slot[] = [
  ...slotsBetween('09:00', '10:00').map((slot): Slot =>
    slot.start === '09:00' ? { ...slot, status: 'PAST' } : slot,
  ),
  ...slotsBetween('10:30', '12:00').map((slot): Slot =>
    slot.start === '11:00' ? { ...slot, status: 'BOOKED', appointmentId: 'a1' } : slot,
  ),
  ...slotsBetween('13:00', '15:00'),
];

const APPOINTMENTS = new Map<string, AppointmentSummary>([
  [
    'a1',
    {
      id: 'a1',
      patient: { id: 'p1', patientCode: 'PAT-000001', name: 'Asha Rao', mobile: '9876543210' },
      doctor: { id: 'd1', name: 'Dr. Kavya Mehta' },
      departmentId: 'dep1',
      date: DATE,
      slotStart: '11:00',
      slotEnd: '11:15',
      purpose: 'Follow-up',
      status: 'ARRIVED',
      createdBy: 'u1',
      arrivedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-01T00:00:00.000Z',
    },
  ],
]);

const renderGrid = (props: Partial<SlotGridProps> = {}) => {
  const all: SlotGridProps = {
    date: DATE,
    slots: SLOTS,
    day: DAY,
    appointments: APPOINTMENTS,
    bookingHref: (slot) => `/appointments/new?slot=${slot.start}`,
    onOpenAppointment: vi.fn(),
    ...props,
  };
  return { ...render(<SlotGrid {...all} />, { wrapper: MemoryRouter }), props: all };
};

afterEach(() => {
  vi.mocked(cn).mockClear();
});

describe('SlotGrid', () => {
  it('links each available slot to its booking', () => {
    renderGrid();

    expect(screen.getByRole('link', { name: /09:15.*Available.*book this slot/ })).toHaveAttribute(
      'href',
      '/appointments/new?slot=09:15',
    );
  });

  it('shows a booked slot with its patient, opening the appointment', async () => {
    const user = userEvent.setup();
    const { props } = renderGrid();

    await user.click(screen.getByRole('button', { name: /11:00.*Asha Rao.*Arrived.*booked/ }));

    expect(props.onOpenAppointment).toHaveBeenCalledWith('a1');
  });

  it('shows a past slot as text, never as something to click', () => {
    renderGrid();

    const past = screen.getByText('09:00').parentElement;
    expect(past).toHaveTextContent('Past');
    expect(past?.tagName).toBe('DIV');
    expect(screen.queryByRole('link', { name: /^09:00/ })).not.toBeInTheDocument();
  });

  it('draws the breaks where they fall, with no slot inside one', () => {
    renderGrid();

    expect(screen.getByText(/10:00–10:30, no appointments/)).toBeInTheDocument();
    expect(screen.getByText(/12:00–13:00, no appointments/)).toBeInTheDocument();
    expect(screen.queryByText('10:15')).not.toBeInTheDocument();
    expect(screen.queryByText('12:15')).not.toBeInTheDocument();
  });

  it('groups slots under their session', () => {
    renderGrid();

    const morning = screen.getByRole('region', { name: 'Morning session' });
    expect(within(morning).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Afternoon session' })).toHaveTextContent('13:00');
  });

  it('offers no booking links in a doctor’s view', () => {
    renderGrid({ bookingHref: null });

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('09:15').parentElement).toHaveTextContent('Available');
  });

  it('re-renders only the changed tile when one slot is booked live', () => {
    const { rerender, props } = renderGrid();
    const initialRenders = vi.mocked(cn).mock.calls.length;
    vi.mocked(cn).mockClear();

    const day = {
      doctorId: 'd1',
      date: DATE,
      timezone: 'Asia/Kolkata',
      slotDurationMinutes: 15,
      slots: SLOTS,
    };
    const next = applyToSlots(day, { id: 'a2', slotStart: '13:15' }, 'created', {
      date: '2099-01-01',
      minutes: 0,
    });
    rerender(<SlotGrid {...props} slots={next.slots} />);

    // 19 tiles rendered at first; the update renders the one booked tile and the two break bands.
    expect(screen.getByRole('button', { name: /13:15.*booked/ })).toBeInTheDocument();
    expect(vi.mocked(cn).mock.calls.length).toBeLessThan(initialRenders / 5);
  });
});
