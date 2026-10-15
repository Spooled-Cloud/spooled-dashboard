import { describe, expect, it } from 'vitest';
import { InvalidTimeoutError, timeoutMsToSeconds } from './timeout';

describe('timeoutMsToSeconds', () => {
  it('converts a positive whole number of seconds', () => {
    expect(timeoutMsToSeconds(1000)).toBe(1);
    expect(timeoutMsToSeconds(2000)).toBe(2);
    expect(timeoutMsToSeconds(86400000)).toBe(86400);
  });

  it('rejects a value that is not a whole number of seconds', () => {
    for (const ms of [0, 1, 500, 999, 1500, 1500.5, -1000, Number.NaN, 86401000]) {
      expect(() => timeoutMsToSeconds(ms)).toThrow(InvalidTimeoutError);
      expect(() => timeoutMsToSeconds(ms)).toThrow(/whole number of seconds/);
    }
  });
});
