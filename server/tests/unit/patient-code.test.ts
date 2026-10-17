import { describe, expect, it } from 'vitest';

import { formatPatientCode } from '#app/utils/patient-code.js';

describe('formatPatientCode', () => {
  it('pads the sequence number to six digits', () => {
    expect(formatPatientCode(1)).toBe('PAT-000001');
    expect(formatPatientCode(123456)).toBe('PAT-123456');
  });

  it('keeps growing past six digits instead of wrapping around', () => {
    expect(formatPatientCode(1234567)).toBe('PAT-1234567');
  });
});
