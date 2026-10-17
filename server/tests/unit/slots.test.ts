import { describe, expect, it } from 'vitest';

import { generateSlots } from '#app/services/slot.service.js';
import { clinicNow } from '#app/utils/clinic-time.js';
import type { DaySchedule } from '#app/utils/schedule.js';
import { dayOfWeek } from '#app/utils/time.js';
import type { TimeRange } from '#app/utils/time.js';

const TUESDAY = '2030-01-15';

const tuesday = (sessions: TimeRange[], breaks: TimeRange[] = []): DaySchedule[] => [
  { dayOfWeek: 2, sessions, breaks },
];

const startsOf = (schedule: DaySchedule[], minutes: number): string[] =>
  generateSlots(schedule, TUESDAY, minutes).map((slot) => slot.start);

describe('generateSlots', () => {
  it('cuts a session into back-to-back slots (the assessment example)', () => {
    expect(generateSlots(tuesday([{ start: '09:00', end: '10:00' }]), TUESDAY, 15)).toEqual([
      { start: '09:00', end: '09:15' },
      { start: '09:15', end: '09:30' },
      { start: '09:30', end: '09:45' },
      { start: '09:45', end: '10:00' },
    ]);
  });

  it('drops the remainder when the slot length does not divide the session', () => {
    expect(generateSlots(tuesday([{ start: '09:00', end: '10:00' }]), TUESDAY, 25)).toEqual([
      { start: '09:00', end: '09:25' },
      { start: '09:25', end: '09:50' },
    ]);
  });

  it('skips a break in the middle of a session', () => {
    const schedule = tuesday(
      [{ start: '09:00', end: '12:00' }],
      [{ start: '10:00', end: '10:30' }],
    );

    expect(startsOf(schedule, 30)).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30']);
  });

  it('handles breaks at the very start and the very end of a session', () => {
    const schedule = tuesday(
      [{ start: '09:00', end: '11:00' }],
      [
        { start: '09:00', end: '09:30' },
        { start: '10:30', end: '11:00' },
      ],
    );

    expect(startsOf(schedule, 30)).toEqual(['09:30', '10:00']);
  });

  it('keeps a slot that ends exactly when a break begins', () => {
    const schedule = tuesday(
      [{ start: '09:00', end: '13:00' }],
      [{ start: '12:00', end: '13:00' }],
    );

    expect(generateSlots(schedule, TUESDAY, 60).at(-1)).toEqual({ start: '11:00', end: '12:00' });
  });

  it('never lets a slot run into a break', () => {
    const schedule = tuesday(
      [{ start: '09:00', end: '10:30' }],
      [{ start: '09:45', end: '10:00' }],
    );

    // 09:30-10:00 would overlap the break, so it is not offered.
    expect(startsOf(schedule, 30)).toEqual(['09:00', '10:00']);
  });

  it('restarts right after a break that is off the slot grid', () => {
    const schedule = tuesday(
      [{ start: '09:00', end: '11:00' }],
      [{ start: '09:40', end: '10:00' }],
    );

    expect(startsOf(schedule, 20)).toEqual(['09:00', '09:20', '10:00', '10:20', '10:40']);
  });

  it('orders slots across sessions, whatever order the sessions are listed in', () => {
    const schedule = tuesday(
      [
        { start: '13:00', end: '14:00' },
        { start: '09:00', end: '10:00' },
      ],
      [{ start: '12:00', end: '13:00' }],
    );

    expect(startsOf(schedule, 30)).toEqual(['09:00', '09:30', '13:00', '13:30']);
  });

  it('returns no slots on a day that is not in the schedule', () => {
    const mondayOnly: DaySchedule[] = [
      { dayOfWeek: 1, sessions: [{ start: '09:00', end: '12:00' }], breaks: [] },
    ];

    expect(generateSlots(mondayOnly, TUESDAY, 15)).toEqual([]);
  });

  it('refuses a slot length that is not a positive whole number', () => {
    expect(() => generateSlots(tuesday([{ start: '09:00', end: '10:00' }]), TUESDAY, 0)).toThrow(
      RangeError,
    );
  });
});

describe('dayOfWeek', () => {
  it('reads the weekday from a calendar date, with no timezone involved', () => {
    expect(dayOfWeek('2030-01-15')).toBe(2);
    expect(dayOfWeek('2030-01-13')).toBe(0);
  });
});

describe('clinicNow in Asia/Kolkata (UTC+5:30, no daylight saving)', () => {
  it('rolls over to the next date at local midnight, not at UTC midnight', () => {
    expect(clinicNow(new Date('2026-10-17T18:29:00Z'))).toEqual({
      date: '2026-10-17',
      minutes: 23 * 60 + 59,
    });
    expect(clinicNow(new Date('2026-10-17T18:30:00Z'))).toEqual({ date: '2026-10-18', minutes: 0 });
  });

  it('keeps the same offset all year round', () => {
    // 03:30 UTC is 09:00 in the clinic in both January and July.
    expect(clinicNow(new Date('2030-01-15T03:30:00Z')).minutes).toBe(9 * 60);
    expect(clinicNow(new Date('2030-07-15T03:30:00Z')).minutes).toBe(9 * 60);
  });
});
