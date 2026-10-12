/**
 * Tests for Jobs API
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { jobsAPI, withExactTotal, JOBS_LIST_MAX_PAGE } from './jobs';
import type { Job, PaginatedResponse } from '@/lib/types';

const API_BASE = 'https://api.spooled.cloud';

describe('jobsAPI', () => {
  describe('list', () => {
    it('should fetch jobs list', async () => {
      const result = await jobsAPI.list();
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should support filtering by status', async () => {
      const result = await jobsAPI.list({ status: 'completed' });
      expect(result.data).toBeDefined();
      result.data.forEach((job) => {
        expect(job.status).toBe('completed');
      });
    });

    it('derives its total from the fetched rows and never calls /jobs/stats', async () => {
      let statsCalls = 0;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/stats`, () => {
          statsCalls += 1;
          return HttpResponse.json({ total: 10000, deadletter: 0 });
        })
      );

      const first = await jobsAPI.list({ per_page: 1 });
      expect(first.data).toHaveLength(1);
      // One more row exists than the page shows: the page can only prove "at least this many".
      expect(first.total).toBe(2);
      expect(first.total_pages).toBe(2);

      await jobsAPI.list({ status: 'pending', queue: 'emails', per_page: 25 });
      expect(statsCalls).toBe(0);
    });

    it('caps a page jump at the maximum page instead of an unbounded OFFSET scan', async () => {
      const offsets: number[] = [];
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          offsets.push(Number(url.searchParams.get('offset')));
          const limit = Number(url.searchParams.get('limit'));
          // A full page plus the extra row that signals "more pages exist".
          return HttpResponse.json(
            Array.from({ length: limit }, (_, i) => ({
              id: `job-deep-${i}`,
              queue_name: 'default',
              status: 'pending',
              priority: 0,
              attempt: 0,
              max_retries: 3,
              job_type: 'noop',
              created_at: '2024-01-01T00:00:00Z',
              scheduled_at: null,
              started_at: null,
              completed_at: null,
            }))
          );
        })
      );

      const result = await jobsAPI.list({ page: 400000, per_page: 25 });

      expect(offsets).toEqual([(JOBS_LIST_MAX_PAGE - 1) * 25]);
      expect(result.page).toBe(JOBS_LIST_MAX_PAGE);
      expect(result.total_pages).toBe(JOBS_LIST_MAX_PAGE);
    });

    it('rejects with the backend message for an invalid filter instead of an empty list', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, () =>
          HttpResponse.json(
            { code: 'VALIDATION_ERROR', message: 'Invalid status filter: bogus' },
            { status: 400 }
          )
        )
      );
      await expect(jobsAPI.list({ status: 'bogus' as never })).rejects.toThrow(
        'Invalid status filter: bogus'
      );
    });

    it('should support filtering by queue', async () => {
      const result = await jobsAPI.list({ queue: 'default' });
      expect(result.data).toBeDefined();
      result.data.forEach((job) => {
        expect(job.queue).toBe('default');
      });
    });

    it('maps job_type from list summaries', async () => {
      const result = await jobsAPI.list();
      expect(result.data[0].job_type).toBe('send_email');
    });

    it('filters list by search id and job_type', async () => {
      const byType = await jobsAPI.list({ search: 'send_email' });
      expect(byType.data.map((j) => j.id)).toEqual(['job-1']);

      const byId = await jobsAPI.list({ search: 'job-1' });
      expect(byId.data.map((j) => j.id)).toEqual(['job-1']);

      const byParam = await jobsAPI.list({ job_type: 'process_image' });
      expect(byParam.data.map((j) => j.id)).toEqual(['job-2']);
    });

    it('scans past the first page so a deep match is still found', async () => {
      // 250 jobs; only the last one is a `deep_match`. A search that filtered
      // just the requested page of 25 would report no results.
      const rows = Array.from({ length: 250 }, (_, i) => ({
        id: `bulk-${i}`,
        queue_name: 'default',
        status: 'completed',
        priority: 0,
        attempt: 0,
        max_retries: 3,
        job_type: i === 249 ? 'deep_match' : 'filler',
        last_error: null,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      }));

      const offsets: number[] = [];
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 50);
          offsets.push(offset);
          return HttpResponse.json(rows.slice(offset, offset + limit));
        })
      );

      const result = await jobsAPI.list({ job_type: 'deep_match' });

      expect(result.data.map((j) => j.id)).toEqual(['bulk-249']);
      expect(result.total).toBe(1);
      // Chunked at the backend's 100-row page cap, and stopped once a short page
      // proved the result set was exhausted.
      expect(offsets).toEqual([0, 100, 200]);
    });

    it('paginates search matches instead of returning every match at once', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        id: `match-${i}`,
        queue_name: 'default',
        status: 'completed',
        priority: 0,
        attempt: 0,
        max_retries: 3,
        job_type: 'same_type',
        last_error: null,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      }));

      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 50);
          return HttpResponse.json(rows.slice(offset, offset + limit));
        })
      );

      const page1 = await jobsAPI.list({ job_type: 'same_type', per_page: 25 });
      expect(page1.data).toHaveLength(25);
      expect(page1.total).toBe(30);
      expect(page1.total_pages).toBe(2);

      const page2 = await jobsAPI.list({ job_type: 'same_type', per_page: 25, page: 2 });
      expect(page2.data).toHaveLength(5);
      expect(page2.data[0].id).toBe('match-25');
    });
  });

  describe('get', () => {
    it('should fetch a single job by ID', async () => {
      const job = await jobsAPI.get('job-1');
      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
      expect(job.job_type).toBe('send_email');
    });

    it('should throw error for non-existent job', async () => {
      await expect(jobsAPI.get('non-existent')).rejects.toThrow();
    });

    it('maps failed_at for failed jobs', async () => {
      const job = await jobsAPI.get('job-3');
      expect(job.status).toBe('failed');
      expect(job.failed_at).toBeTruthy();
    });

    it('maps next_retry_at for pending jobs with last_error', async () => {
      const job = await jobsAPI.get('job-4');
      expect(job.status).toBe('pending');
      expect(job.next_retry_at).toBe('2024-01-01T00:05:00Z');
    });
  });

  describe('create', () => {
    it('should create a new job', async () => {
      const newJob = await jobsAPI.create({
        queue: 'default',
        job_type: 'test_job',
        payload: { test: true },
      });

      expect(newJob).toBeDefined();
      expect(newJob.id).toBeDefined();
      expect(typeof newJob.created).toBe('boolean');
    });

    it('sends non-object JSON payloads without spreading them into objects', async () => {
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'job-any-json', created: true }, { status: 201 });
        })
      );

      await jobsAPI.create({
        queue: 'default',
        job_type: 'test_job',
        payload: 'hello',
      });
      expect(posted?.payload).toBe('hello');

      await jobsAPI.create({
        queue: 'default',
        job_type: 'test_job',
        payload: [1, 2],
      });
      expect(posted?.payload).toEqual([1, 2]);
    });

    it('writes job_type into object payloads only', async () => {
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'job-object', created: true }, { status: 201 });
        })
      );

      await jobsAPI.create({
        queue: 'default',
        job_type: 'test_job',
        payload: { test: true },
      });
      expect(posted?.payload).toEqual({ test: true, job_type: 'test_job' });
    });

    it('clamps timeout_ms under one second to timeout_seconds 1', async () => {
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'job-timeout', created: true }, { status: 201 });
        })
      );

      await jobsAPI.create({
        queue: 'default',
        job_type: 'test_job',
        payload: { test: true },
        timeout_ms: 500,
      });

      expect(posted?.timeout_seconds).toBe(1);
      expect(posted).not.toHaveProperty('timeout_ms');
    });
  });

  describe('retry', () => {
    it('should retry a failed job', async () => {
      const result = await jobsAPI.retry('job-3');
      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      // Backend increments retry_count on retry
      expect(result.attempt).toBeGreaterThan(0);
    });
  });

  describe('retry limits', () => {
    it('surfaces the backend message when reviving a failed workflow hits max_workflows', async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/jobs/:id/retry`, () =>
          HttpResponse.json(
            { code: 'LIMIT_EXCEEDED', message: 'Workflow limit reached (5/5)' },
            { status: 429 }
          )
        )
      );
      await expect(jobsAPI.retry('job-3')).rejects.toThrow('Workflow limit reached (5/5)');
    });

    it('does not expose a hard-delete call (DELETE /jobs/{id} only cancels)', () => {
      expect((jobsAPI as unknown as Record<string, unknown>).delete).toBeUndefined();
    });
  });

  describe('cancel', () => {
    it('should cancel a pending job', async () => {
      // cancel uses DELETE endpoint which returns void
      await expect(jobsAPI.cancel('job-2')).resolves.toBeUndefined();
    });
  });

  describe('getListTotal', () => {
    const statsBody = {
      total: 10000,
      pending: 4000,
      scheduled: 0,
      processing: 0,
      completed: 6000,
      failed: 0,
      cancelled: 0,
      deadletter: 0,
    };

    it('reads the total, or one status, from /jobs/stats within the queue filter', async () => {
      let statsQueue: string | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/stats`, ({ request }) => {
          statsQueue = new URL(request.url).searchParams.get('queue_name');
          return HttpResponse.json(statsBody);
        })
      );

      expect(await jobsAPI.getListTotal()).toBe(10000);
      expect(await jobsAPI.getListTotal({ status: 'pending', queue: 'emails' })).toBe(4000);
      expect(statsQueue).toBe('emails');
      expect(await jobsAPI.getListTotal({ status: ['completed'] })).toBe(6000);
    });

    it('has no exact total for a multi-status filter, and does not call stats for it', async () => {
      let statsCalls = 0;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/stats`, () => {
          statsCalls += 1;
          return HttpResponse.json(statsBody);
        })
      );
      expect(await jobsAPI.getListTotal({ status: ['failed', 'deadletter'] })).toBeUndefined();
      expect(statsCalls).toBe(0);
    });

    it('rejects when /jobs/stats fails so the caller can fall back to the page-derived total', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/stats`, () =>
          HttpResponse.json({ message: 'boom' }, { status: 500 })
        )
      );
      await expect(jobsAPI.getListTotal()).rejects.toThrow('boom');
    });
  });

  describe('withExactTotal', () => {
    const page = (total: number, totalPages: number): PaginatedResponse<Job> => ({
      data: [],
      page: 1,
      per_page: 25,
      total,
      total_pages: totalPages,
    });

    it('raises the total and page count to the exact figure', () => {
      const result = withExactTotal(page(26, 2), 4000);
      expect(result.total).toBe(4000);
      expect(result.total_pages).toBe(160);
    });

    it('never reports fewer jobs than the page already proves exist', () => {
      const result = withExactTotal(page(26, 2), 10);
      expect(result.total).toBe(26);
      expect(result.total_pages).toBe(2);
    });

    it('keeps the page-derived figures when there is no exact total', () => {
      const original = page(26, 2);
      expect(withExactTotal(original, undefined)).toBe(original);
      expect(withExactTotal(original, Number.NaN)).toBe(original);
    });

    it('caps the page count while keeping the exact total', () => {
      const result = withExactTotal(page(26, 2), 10_000_000);
      expect(result.total).toBe(10_000_000);
      expect(result.total_pages).toBe(JOBS_LIST_MAX_PAGE);
    });
  });

  describe('getStatistics', () => {
    it('should fetch job statistics', async () => {
      const stats = await jobsAPI.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.total).toBe(1000);
      expect(stats.pending).toBe(50);
      expect(stats.scheduled).toBe(5);
      expect(stats.completed).toBe(900);
    });
  });

  describe('batchStatus', () => {
    it('should fetch batch job status', async () => {
      const statuses = await jobsAPI.batchStatus(['job-1', 'job-2']);
      expect(statuses).toBeDefined();
      expect(Array.isArray(statuses)).toBe(true);
    });

    it('maps retry_count onto attempt', async () => {
      const statuses = await jobsAPI.batchStatus(['job-1', 'job-3']);
      expect(statuses[0]).toMatchObject({
        id: 'job-1',
        queue_name: 'default',
        attempt: 1,
        created_at: '2024-01-01T00:00:00Z',
      });
      expect(statuses[1]).toMatchObject({
        id: 'job-3',
        queue_name: 'emails',
        attempt: 3,
      });
      expect(statuses[0]).not.toHaveProperty('retry_count');
    });

    it('should return empty array for empty input', async () => {
      const statuses = await jobsAPI.batchStatus([]);
      expect(statuses).toEqual([]);
    });

    it('should throw error for more than 100 IDs', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `job-${i}`);
      await expect(jobsAPI.batchStatus(ids)).rejects.toThrow('Maximum 100 job IDs per request');
    });
  });

  describe('listDeadLetter', () => {
    it('maps DLQ summaries from attempt and job_type', async () => {
      const jobs = await jobsAPI.listDeadLetter();
      expect(jobs[0]).toMatchObject({
        id: 'job-dlq-1',
        queue: 'emails',
        status: 'deadletter',
        job_type: 'send_notification',
        attempt: 3,
        max_retries: 3,
        error: { type: 'Error', message: 'Connection refused' },
      });
    });
  });
});
