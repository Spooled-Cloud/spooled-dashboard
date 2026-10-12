import { describe, it, expect } from 'vitest';
import {
  JOB_FILTER_STATUSES,
  createdRange,
  hasUncountableFilters,
  jobFiltersToQueryString,
  parseJobFilters,
} from './job-list-filters';

describe('job list filters', () => {
  describe('status options', () => {
    it('has no Failed option: no job ever gets that status', () => {
      expect(JOB_FILTER_STATUSES).not.toContain('failed');
      expect(JOB_FILTER_STATUSES).toContain('deadletter');
    });
  });

  describe('parseJobFilters', () => {
    it('reads every filter from the query string', () => {
      expect(
        parseJobFilters(
          '?status=pending&queue=emails&job_type=send_email&search=abc&tag=urgent&from=2026-10-01&to=2026-10-05'
        )
      ).toEqual({
        status: 'pending',
        queue: 'emails',
        job_type: 'send_email',
        search: 'abc',
        tag: 'urgent',
        from: '2026-10-01',
        to: '2026-10-05',
      });
    });

    it('accepts q as an alias of search', () => {
      expect(parseJobFilters('?q=abc').search).toBe('abc');
      expect(parseJobFilters('?search=x&q=y').search).toBe('x');
    });

    it('opens a legacy ?status=failed link on the dead-letter jobs', () => {
      expect(parseJobFilters('?status=failed').status).toBe('deadletter');
      expect(parseJobFilters('?status=FAILED').status).toBe('deadletter');
    });

    it('drops an unknown status and malformed days', () => {
      const parsed = parseJobFilters('?status=bogus&from=yesterday&to=2026-02-31');
      expect(parsed.status).toBeUndefined();
      expect(parsed.from).toBeUndefined();
      expect(parsed.to).toBeUndefined();
    });

    it('is empty for an empty query string', () => {
      expect(Object.values(parseJobFilters('')).every((v) => v === undefined)).toBe(true);
    });
  });

  describe('jobFiltersToQueryString', () => {
    it('round-trips through parseJobFilters', () => {
      const filters = {
        status: 'deadletter' as const,
        queue: 'emails',
        job_type: 'send_email',
        search: 'a b',
        tag: 'urgent',
        from: '2026-10-01',
        to: '2026-10-05',
      };
      expect(parseJobFilters(jobFiltersToQueryString(filters))).toEqual(filters);
    });

    it('is empty when nothing is set', () => {
      expect(jobFiltersToQueryString({})).toBe('');
    });
  });

  describe('createdRange', () => {
    it('turns inclusive local days into an inclusive start and an exclusive end instant', () => {
      const range = createdRange('2026-10-01', '2026-10-05');
      expect(range.created_after).toBe(new Date(2026, 9, 1).toISOString());
      // `to` is a whole day: the exclusive end is the start of the next day
      expect(range.created_before).toBe(new Date(2026, 9, 6).toISOString());
    });

    it('rolls the end over a month and a year boundary', () => {
      expect(createdRange(undefined, '2026-10-31').created_before).toBe(
        new Date(2026, 10, 1).toISOString()
      );
      expect(createdRange(undefined, '2026-12-31').created_before).toBe(
        new Date(2027, 0, 1).toISOString()
      );
    });

    it('sends UTC instants: no + offset has to survive a query string', () => {
      const { created_after, created_before } = createdRange('2026-10-01', '2026-10-02');
      expect(created_after).toMatch(/Z$/);
      expect(created_before).toMatch(/Z$/);
    });

    it('allows an open-ended window and ignores invalid days', () => {
      expect(createdRange('2026-10-01')).toEqual({
        created_after: new Date(2026, 9, 1).toISOString(),
        created_before: undefined,
      });
      expect(createdRange('nope', '2026-13-01')).toEqual({
        created_after: undefined,
        created_before: undefined,
      });
      expect(createdRange()).toEqual({ created_after: undefined, created_before: undefined });
    });
  });

  describe('hasUncountableFilters', () => {
    it('is true for filters the stats query cannot count', () => {
      expect(hasUncountableFilters({ search: 'x' })).toBe(true);
      expect(hasUncountableFilters({ job_type: 'x' })).toBe(true);
      expect(hasUncountableFilters({ tag: 'x' })).toBe(true);
      expect(hasUncountableFilters({ from: '2026-10-01' })).toBe(true);
      expect(hasUncountableFilters({ to: '2026-10-01' })).toBe(true);
    });

    it('is false for a queue and a status, which GET /jobs/stats counts', () => {
      expect(hasUncountableFilters({})).toBe(false);
      expect(hasUncountableFilters({ queue: 'emails', status: 'pending' })).toBe(false);
    });
  });
});
