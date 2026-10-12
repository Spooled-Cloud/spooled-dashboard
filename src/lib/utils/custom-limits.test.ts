import { describe, it, expect } from 'vitest';
import { mergeCustomLimits, limitToFormValue, UNLIMITED } from './custom-limits';

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

describe('unlimited caps', () => {
  it('saves an explicit Unlimited choice as -1 for a resource cap', () => {
    expect(
      mergeCustomLimits({ max_workers: 5 }, { max_workers: '5' }, { max_workers: UNLIMITED })
    ).toEqual({ max_workers: -1 });
  });

  it('never writes unlimited for a setting that cannot be unlimited', () => {
    expect(
      mergeCustomLimits(
        null,
        { rate_limit_burst: '' },
        { rate_limit_burst: UNLIMITED, max_queues: UNLIMITED }
      )
    ).toEqual({ max_queues: -1 });
  });

  it('shows stored null or -1 on a cap as Unlimited, and leaves it alone when untouched', () => {
    expect(limitToFormValue('max_queues', null)).toBe(UNLIMITED);
    expect(limitToFormValue('max_queues', -1)).toBe(UNLIMITED);
    expect(limitToFormValue('max_queues', 4)).toBe('4');
    expect(limitToFormValue('job_retention_days', null)).toBe('');
    expect(
      mergeCustomLimits({ max_queues: null }, { max_queues: UNLIMITED }, { max_queues: UNLIMITED })
    ).toEqual({ max_queues: null });
  });

  it('can turn Unlimited back into a number or the plan default', () => {
    expect(
      mergeCustomLimits({ max_queues: -1 }, { max_queues: UNLIMITED }, { max_queues: '7' })
    ).toEqual({ max_queues: 7 });
    expect(
      mergeCustomLimits({ max_queues: -1 }, { max_queues: UNLIMITED }, { max_queues: '' })
    ).toBeNull();
  });
});
