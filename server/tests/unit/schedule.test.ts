import { describe, expect, it } from 'vitest';

import { findScheduleProblems } from '#app/utils/schedule.js';
import type { DaySchedule } from '#app/utils/schedule.js';

// The assessment's example day: two sessions with lunch in between.
const monday: DaySchedule = {
  dayOfWeek: 1,
  sessions: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '17:00' },
  ],
  breaks: [{ start: '12:00', end: '13:00' }],
};

const messagesFor = (schedule: DaySchedule[]): string[] =>
  findScheduleProblems(schedule).map((problem) => problem.message);

describe('findScheduleProblems', () => {
  it('accepts the assessment example, with lunch between two sessions', () => {
    expect(findScheduleProblems([monday])).toEqual([]);
  });

  it('accepts a break inside a session and sessions that only touch', () => {
    const tuesday: DaySchedule = {
      dayOfWeek: 2,
      sessions: [
        { start: '09:00', end: '12:00' },
        { start: '12:00', end: '17:00' },
      ],
      breaks: [{ start: '10:30', end: '10:45' }],
    };

    expect(findScheduleProblems([tuesday])).toEqual([]);
  });

  it('rejects a range whose start is not before its end', () => {
    const day = { ...monday, sessions: [{ start: '12:00', end: '09:00' }], breaks: [] };

    expect(findScheduleProblems([day])).toEqual([
      { path: [0, 'sessions', 0], message: 'Start 12:00 must be before end 09:00' },
    ]);
  });

  it('rejects badly formatted times', () => {
    expect(messagesFor([{ ...monday, breaks: [{ start: '12:00', end: '1pm' }] }])).toEqual([
      'Times must use the HH:mm format',
    ]);
  });

  it('rejects overlapping sessions and overlapping breaks', () => {
    const day: DaySchedule = {
      dayOfWeek: 1,
      sessions: [
        { start: '09:00', end: '12:00' },
        { start: '11:00', end: '14:00' },
      ],
      breaks: [
        { start: '10:00', end: '10:30' },
        { start: '10:15', end: '10:45' },
      ],
    };

    expect(messagesFor([day])).toEqual([
      'Sessions 09:00-12:00 and 11:00-14:00 overlap',
      'Breaks 10:00-10:30 and 10:15-10:45 overlap',
    ]);
  });

  it('rejects a break outside working hours', () => {
    const day = { ...monday, breaks: [{ start: '17:00', end: '17:30' }] };

    expect(findScheduleProblems([day])).toEqual([
      {
        path: [0, 'breaks', 0],
        message: 'Break 17:00-17:30 must fall within working hours 09:00-17:00',
      },
    ]);
  });

  it('rejects a repeated day and a day without sessions', () => {
    const wednesdayOff: DaySchedule = { dayOfWeek: 3, sessions: [], breaks: [] };

    expect(findScheduleProblems([monday, { ...monday }, wednesdayOff])).toEqual([
      { path: [1, 'dayOfWeek'], message: 'Day 1 is listed more than once' },
      { path: [2, 'sessions'], message: 'A working day needs at least one session' },
    ]);
  });

  it('rejects a day number outside 0-6', () => {
    expect(messagesFor([{ ...monday, dayOfWeek: 7 }])).toEqual([
      'dayOfWeek must be 0 (Sunday) to 6 (Saturday)',
    ]);
  });
});
