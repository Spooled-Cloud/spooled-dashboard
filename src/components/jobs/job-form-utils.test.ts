import { describe, it, expect } from 'vitest';
import { localDateTimeToIso, parseIntInRange, parseMaxRetries } from './job-form-utils';

describe('parseMaxRetries', () => {
  it('keeps 0', () => {
    expect(parseMaxRetries('0')).toBe(0);
  });

  it('falls back to 3 only when the value is not a number', () => {
    expect(parseMaxRetries('')).toBe(3);
    expect(parseMaxRetries('abc')).toBe(3);
  });

  it('clamps to 0..100', () => {
    expect(parseMaxRetries('-4')).toBe(0);
    expect(parseMaxRetries('101')).toBe(100);
    expect(parseMaxRetries('7')).toBe(7);
  });
});

describe('parseIntInRange', () => {
  it('uses the fallback for NaN', () => {
    expect(parseIntInRange('', 5, 0, 10)).toBe(5);
  });
});

describe('localDateTimeToIso', () => {
  it('converts a datetime-local value to a UTC instant with seconds', () => {
    const value = '2026-10-11T14:30';
    expect(localDateTimeToIso(value)).toBe(new Date(value).toISOString());
    expect(localDateTimeToIso(value)).toMatch(/Z$/);
  });

  it('returns undefined for empty and null for garbage', () => {
    expect(localDateTimeToIso('')).toBeUndefined();
    expect(localDateTimeToIso('not a date')).toBeNull();
  });
});
