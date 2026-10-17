import { describe, expect, it } from 'vitest';

import { isValidMobile, normalizeMobile } from '#app/utils/mobile.js';

describe('normalizeMobile', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['98765 43210', '9876543210'],
    ['+91 98765-43210', '9876543210'],
    ['919876543210', '9876543210'],
    ['09876543210', '9876543210'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  it('keeps a 10-digit number that happens to start with 91', () => {
    expect(normalizeMobile('9123456789')).toBe('9123456789');
  });

  it('leaves partial input usable as a search prefix', () => {
    expect(normalizeMobile('98765')).toBe('98765');
  });
});

describe('isValidMobile', () => {
  it('accepts only 10 digits starting with 6, 7, 8 or 9', () => {
    expect(isValidMobile('6123456789')).toBe(true);
    expect(isValidMobile('5123456789')).toBe(false);
    expect(isValidMobile('987654321')).toBe(false);
  });
});
