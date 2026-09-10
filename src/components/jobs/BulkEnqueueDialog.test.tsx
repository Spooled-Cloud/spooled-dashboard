import { describe, it, expect } from 'vitest';
import { jobHasRequiredPayload } from './BulkEnqueueDialog';

describe('jobHasRequiredPayload', () => {
  it('accepts non-object JSON payloads the old object check rejected', () => {
    expect(jobHasRequiredPayload({ payload: 'hello' })).toBe(true);
    expect(jobHasRequiredPayload({ payload: false })).toBe(true);
    expect(jobHasRequiredPayload({ payload: 0 })).toBe(true);
    expect(jobHasRequiredPayload({ payload: [] })).toBe(true);
    expect(jobHasRequiredPayload({ payload: null })).toBe(true);
  });

  it('rejects jobs that omit payload', () => {
    expect(jobHasRequiredPayload({})).toBe(false);
    expect(jobHasRequiredPayload(null)).toBe(false);
    expect(jobHasRequiredPayload('job')).toBe(false);
  });
});
