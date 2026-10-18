import { describe, expect, it } from 'vitest';

import {
  clampDate,
  dateForKey,
  endOfWeek,
  monthGrid,
  shiftMonths,
  startOfWeek,
} from '@/components/ui/calendar';

describe('the calendar grid', () => {
  it('lays a month out in Monday-first weeks', () => {
    // 1 October 2026 is a Thursday: three empty cells before it.
    const weeks = monthGrid('2026-10-19');

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weeks[4]).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null,
    ]);
  });

  it('finds the ends of a week', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // a Sunday ends its week
    expect(endOfWeek('2026-10-19')).toBe('2026-10-25');
  });

  it('keeps the day when changing month, or uses the shorter month’s last day', () => {
    expect(shiftMonths('2026-10-19', 1)).toBe('2026-11-19');
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonths('2026-03-31', -13)).toBe('2025-02-28');
  });

  it('moves focus the way the WAI-ARIA date picker pattern says', () => {
    expect(dateForKey('ArrowRight', '2026-10-31', false)).toBe('2026-11-01');
    expect(dateForKey('ArrowUp', '2026-10-05', false)).toBe('2026-09-28');
    expect(dateForKey('Home', '2026-10-22', false)).toBe('2026-10-19');
    expect(dateForKey('End', '2026-10-22', false)).toBe('2026-10-25');
    expect(dateForKey('PageDown', '2026-10-22', false)).toBe('2026-11-22');
    expect(dateForKey('PageUp', '2026-10-22', true)).toBe('2025-10-22');
    expect(dateForKey('Tab', '2026-10-22', false)).toBeNull();
  });

  it('keeps a date within its bounds', () => {
    expect(clampDate('2026-10-01', '2026-10-18')).toBe('2026-10-18');
    expect(clampDate('2026-12-01', undefined, '2026-11-30')).toBe('2026-11-30');
    expect(clampDate('2026-10-20', '2026-10-18', '2026-11-30')).toBe('2026-10-20');
  });
});
