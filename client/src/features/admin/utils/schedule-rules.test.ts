import { describe, expect, it } from 'vitest';

import { findScheduleProblems } from '@/features/admin/utils/schedule-rules';

const day = (sessions: [string, string][], breaks: [string, string][] = []) => ({
  dayOfWeek: 1,
  sessions: sessions.map(([start, end]) => ({ start, end })),
  breaks: breaks.map(([start, end]) => ({ start, end })),
});

describe('findScheduleProblems', () => {
  it('accepts a morning and an afternoon session with lunch between them', () => {
    expect(
      findScheduleProblems([
        day(
          [
            ['09:00', '12:00'],
            ['13:00', '17:00'],
          ],
          [['12:00', '13:00']],
        ),
      ]),
    ).toEqual([]);
  });

  it('accepts sessions that only touch', () => {
    expect(
      findScheduleProblems([
        day([
          ['09:00', '12:00'],
          ['12:00', '13:00'],
        ]),
      ]),
    ).toEqual([]);
  });

  it('finds overlapping sessions, pointing at the later one', () => {
    expect(
      findScheduleProblems([
        day([
          ['09:00', '12:00'],
          ['11:00', '14:00'],
        ]),
      ]),
    ).toEqual([
      { path: [0, 'sessions', 1], message: 'Sessions 09:00-12:00 and 11:00-14:00 overlap' },
    ]);
  });

  it('finds a range that ends before it starts', () => {
    expect(findScheduleProblems([day([['14:00', '10:00']])])).toEqual([
      { path: [0, 'sessions', 0], message: 'Start 14:00 must be before end 10:00' },
    ]);
  });

  it('needs breaks to fall within working hours', () => {
    expect(findScheduleProblems([day([['09:00', '14:00']], [['18:00', '18:30']])])).toEqual([
      {
        path: [0, 'breaks', 0],
        message: 'Break 18:00-18:30 must fall within working hours 09:00-14:00',
      },
    ]);
  });

  it('needs a session on every working day, and both times of every range', () => {
    expect(findScheduleProblems([day([]), day([['09:00', '']])])).toEqual([
      { path: [0, 'sessions'], message: 'A working day needs at least one session' },
      { path: [1, 'sessions', 0], message: 'Enter both times' },
    ]);
  });
});
