import { describe, expect, it } from 'vitest';

import type { AppointmentStatus } from '@/constants/appointment';
import { summarizeDay } from '@/features/dashboard/utils/summary';
import type { AppointmentSummary } from '@/types/models';

const appointment = (
  id: string,
  slotStart: string,
  status: AppointmentStatus,
  doctor = { id: 'd1', name: 'Dr. Kavya Mehta' },
): AppointmentSummary => ({
  id,
  patient: {
    id: `p-${id}`,
    patientCode: 'PAT-000001',
    name: `Patient ${id}`,
    mobile: '9876543210',
  },
  doctor,
  departmentId: 'dep-1',
  date: '2026-10-19',
  slotStart,
  slotEnd: slotStart,
  purpose: 'Check-up',
  status,
  createdBy: 'u1',
  arrivedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-10-18T10:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
});

const NOW = { date: '2026-10-19', minutes: 10 * 60 }; // 10:00 at the clinic

describe('summarizeDay', () => {
  const day = [
    appointment('a', '11:30', 'SCHEDULED'),
    appointment('b', '09:00', 'COMPLETED'),
    appointment('c', '09:45', 'ARRIVED'),
    appointment('d', '09:30', 'SCHEDULED'),
    appointment('e', '10:30', 'CANCELLED'),
    appointment('f', '10:15', 'SCHEDULED', { id: 'd2', name: 'Dr. Arjun Rao' }),
  ];

  it('counts the day by status; cancelled ones hold no slot', () => {
    const summary = summarizeDay(day, NOW);

    expect(summary.counts).toEqual({ SCHEDULED: 3, ARRIVED: 1, COMPLETED: 1, CANCELLED: 1 });
    expect(summary.active).toBe(5);
  });

  it("splits what's left into waiting, next and late, in slot order", () => {
    const summary = summarizeDay(day, NOW);

    expect(summary.waiting.map((item) => item.id)).toEqual(['c']);
    expect(summary.upcoming.map((item) => item.id)).toEqual(['f', 'a']);
    expect(summary.late.map((item) => item.id)).toEqual(['d']);
  });

  it("gives each doctor's load, sorted by name", () => {
    const summary = summarizeDay(day, NOW);

    expect(summary.doctors.map((doctor) => [doctor.doctorName, doctor.active])).toEqual([
      ['Dr. Arjun Rao', 1],
      ['Dr. Kavya Mehta', 4],
    ]);
  });

  it('handles a day with nothing booked', () => {
    expect(summarizeDay([], NOW)).toMatchObject({ active: 0, waiting: [], doctors: [] });
  });
});
