import { describe, expect, it } from 'vitest';

import {
  isValidDate,
  isValidTime,
  minutesToTime,
  rangeContains,
  rangesOverlap,
  timeToMinutes,
} from '#app/utils/time.js';

describe('time helpers', () => {
  it('converts between HH:mm and minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(23 * 60 + 59)).toBe('23:59');
  });

  it('accepts only real 24-hour times', () => {
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
  });

  it('accepts only real calendar dates', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-1-5')).toBe(false);
  });

  it('treats ranges as half-open, so touching ranges do not overlap', () => {
    const morning = { start: '09:00', end: '12:00' };

    expect(rangesOverlap(morning, { start: '12:00', end: '13:00' })).toBe(false);
    expect(rangesOverlap(morning, { start: '11:59', end: '13:00' })).toBe(true);
    expect(rangeContains({ start: '09:00', end: '17:00' }, { start: '12:00', end: '13:00' })).toBe(
      true,
    );
    expect(rangeContains(morning, { start: '11:30', end: '12:30' })).toBe(false);
  });
});
