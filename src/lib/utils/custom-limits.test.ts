import { describe, it, expect } from 'vitest';
import { mergeCustomLimits } from './custom-limits';

describe('mergeCustomLimits', () => {
  it('keeps unedited keys, including hidden ones and explicit null', () => {
    const existing = {
      max_jobs_per_day: null,
      job_retention_days: 365,
      max_workers: 5,
      extra_key: 7,
    };
    const initial = { max_jobs_per_day: '', max_workers: '5' };
    const edited = { max_jobs_per_day: '', max_workers: '10' };
    expect(mergeCustomLimits(existing, initial, edited)).toEqual({
      max_jobs_per_day: null,
      job_retention_days: 365,
      max_workers: 10,
      extra_key: 7,
    });
  });

  it('removes a key only when the operator cleared it', () => {
    const existing = { max_workers: 5, max_queues: 3 };
    const initial = { max_workers: '5', max_queues: '3' };
    const edited = { max_workers: '', max_queues: '3' };
    expect(mergeCustomLimits(existing, initial, edited)).toEqual({ max_queues: 3 });
  });

  it('adds a newly typed key and ignores invalid input', () => {
    const initial = { rate_limit_burst: '', max_queues: '2' };
    const edited = { rate_limit_burst: '500', max_queues: 'abc' };
    expect(mergeCustomLimits({ max_queues: 2 }, initial, edited)).toEqual({
      rate_limit_burst: 500,
      max_queues: 2,
    });
  });

  it('returns null when no overrides remain', () => {
    expect(
      mergeCustomLimits({ max_workers: 5 }, { max_workers: '5' }, { max_workers: '' })
    ).toBeNull();
    expect(mergeCustomLimits(null, {}, {})).toBeNull();
  });
});
