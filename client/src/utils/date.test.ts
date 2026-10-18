import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  ageOn,
  clinicMoment,
  dayOfWeek,
  daysInMonth,
  formatDate,
  formatDateLong,
  formatTimestamp,
  isValidDate,
} from '@/utils/date';

describe('clinic dates', () => {
  it("reads today and the minute on the clinic's clock (Asia/Kolkata), not the browser's", () => {
    // 20:00 UTC on 18 October is 01:30 on 19 October in Kolkata.
    expect(clinicMoment(new Date('2026-10-18T20:00:00Z'))).toEqual({
      date: '2026-10-19',
      minutes: 90,
    });
  });

  it('accepts only real calendar dates', () => {
    expect(isValidDate('2026-10-19')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('19-10-2026')).toBe(false);
  });

  it('adds days and months across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('numbers weekdays like the API, from 0 = Sunday', () => {
    expect(dayOfWeek('2026-10-18')).toBe(0);
    expect(dayOfWeek('2026-10-19')).toBe(1);
  });

  it('knows how long each month is', () => {
    expect(daysInMonth('2026-02-10')).toBe(28);
    expect(daysInMonth('2028-02-10')).toBe(29);
    expect(daysInMonth('2026-10-01')).toBe(31);
  });

  it('formats dates the way Indian clinics write them', () => {
    expect(formatDateLong('2026-10-19')).toBe('Monday, 19 October 2026');
    expect(formatDate('2026-10-19')).toBe('19 Oct 2026');
  });

  it("shows API timestamps on the clinic's clock", () => {
    expect(formatTimestamp('2026-10-18T11:46:46.075Z')).toBe('18 Oct 2026, 17:16');
  });

  it('counts age in whole years, birthday included', () => {
    expect(ageOn('1990-05-14', '2026-05-13')).toBe(35);
    expect(ageOn('1990-05-14', '2026-05-14')).toBe(36);
  });
});
