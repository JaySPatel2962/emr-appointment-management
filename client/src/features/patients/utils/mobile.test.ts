import { describe, expect, it } from 'vitest';

import { formatMobile, isValidMobile, normalizeMobile } from '@/features/patients/utils/mobile';

describe('mobile numbers', () => {
  it('normalizes the ways people type an Indian mobile number', () => {
    expect(normalizeMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeMobile('098765-43210')).toBe('9876543210');
    expect(normalizeMobile('(98765) 43210')).toBe('9876543210');
    expect(normalizeMobile('919876543210')).toBe('9876543210');
  });

  it('accepts only 10 digits starting with 6 to 9', () => {
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('+91 6012345678')).toBe(true);
    expect(isValidMobile('5876543210')).toBe(false);
    expect(isValidMobile('98765')).toBe(false);
  });

  it('groups the digits 5 and 5 for display', () => {
    expect(formatMobile('9876543210')).toBe('98765 43210');
  });
});
