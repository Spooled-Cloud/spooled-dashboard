/**
 * Tests for Jobs API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import {
  jobsAPI,
  withExactTotal,
  JOBS_FILTER_UNSUPPORTED_MESSAGE,
  JOBS_LIST_MAX_PAGE,
  resetHasMoreProbe,
} from './jobs';
import type { JobListPage } from './jobs';
import { APIError } from './client';

const API_BASE = 'https://api.spooled.cloud';

/** A `JobSummary` row as `GET /jobs` returns it. */
function summaryRow(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `row-${i}`,
    queue_name: 'default',
    status: 'completed',
    priority: 0,
    attempt: 0,
    max_retries: 3,
    job_type: 'noop',
    last_error: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    ...extra,
  };
}

describe('jobsAPI', () => {
  beforeEach(() => {
    // Whether a response carried a readable X-Has-More is remembered between calls.
    resetHasMoreProbe();
  });

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

    it('filters by q and job_type on the server (id prefix, queue or type; exact type)', async () => {
      const byType = await jobsAPI.list({ search: 'send_email' });
      expect(byType.data.map((j) => j.id)).toEqual(['job-1']);

      // q matches an id PREFIX: "job-" starts every mock id, "ob-1" starts none
      const byIdPrefix = await jobsAPI.list({ search: 'job-1' });
      expect(byIdPrefix.data.map((j) => j.id)).toEqual(['job-1']);
      const notAPrefix = await jobsAPI.list({ search: 'ob-1' });
      expect(notAPrefix.data).toEqual([]);

      // ...or a substring of the queue name
      const byQueue = await jobsAPI.list({ search: 'retry-q' });
      expect(byQueue.data.map((j) => j.id)).toEqual(['job-4']);

      const byParam = await jobsAPI.list({ job_type: 'process_image' });
      expect(byParam.data.map((j) => j.id)).toEqual(['job-2']);
    });

    it('sends q, job_type, tag and the created window as query parameters', async () => {
      let seen: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          seen = new URL(request.url).searchParams;
          return HttpResponse.json([]);
        })
      );

      await jobsAPI.list({
        search: '  send_email ',
        job_type: 'process_image',
        tag: 'urgent',
        queue: 'emails',
        created_after: '2026-10-01T00:00:00.000Z',
        created_before: '2026-10-02T00:00:00.000Z',
      });

      expect(seen?.get('q')).toBe('send_email');
      expect(seen?.get('job_type')).toBe('process_image');
      expect(seen?.get('tag')).toBe('urgent');
      expect(seen?.get('queue_name')).toBe('emails');
      expect(seen?.get('created_after')).toBe('2026-10-01T00:00:00.000Z');
      expect(seen?.get('created_before')).toBe('2026-10-02T00:00:00.000Z');
    });

    it('leaves out filters that are empty', async () => {
      let seen: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          seen = new URL(request.url).searchParams;
          return HttpResponse.json([]);
        })
      );

      await jobsAPI.list({ search: '  ', job_type: '', tag: ' ', queue: '', status: [] });

      for (const key of ['q', 'job_type', 'tag', 'queue_name', 'status']) {
        expect(seen?.has(key)).toBe(false);
      }
    });

    it('sends several statuses as ONE comma-joined value, in one request', async () => {
      const requests: string[] = [];
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          requests.push(new URL(request.url).searchParams.get('status') ?? '');
          return HttpResponse.json([]);
        })
      );

      await jobsAPI.list({ status: ['deadletter', 'cancelled'] });
      await jobsAPI.list({ status: 'pending' });

      expect(requests).toEqual(['deadletter,cancelled', 'pending']);
    });

    it('filters the mock backend by a status list', async () => {
      const result = await jobsAPI.list({ status: ['completed', 'failed'] });
      expect(result.data.map((j) => j.id).sort()).toEqual(['job-1', 'job-3']);
    });

    it('never scans: a search is one request for one page, however deep the match', async () => {
      const offsets: number[] = [];
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          offsets.push(Number(url.searchParams.get('offset')));
          return HttpResponse.json([summaryRow(1, { job_type: 'deep_match' })], {
            headers: { 'X-Has-More': 'false' },
          });
        })
      );

      const result = await jobsAPI.list({ job_type: 'deep_match', search: 'deep' });

      expect(offsets).toEqual([0]);
      expect(result.data.map((j) => j.id)).toEqual(['row-1']);
    });

    it('does not fall back to GET /jobs/{id} for a full job id (q matches id prefixes)', async () => {
      let jobGets = 0;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, () =>
          HttpResponse.json([], { headers: { 'X-Has-More': 'false' } })
        ),
        http.get(`${API_BASE}/api/v1/jobs/:id`, () => {
          jobGets += 1;
          return HttpResponse.json({}, { status: 404 });
        })
      );

      const result = await jobsAPI.list({ search: '0b5f2c1e-8d4a-4f6b-9c3d-1a2b3c4d5e6f' });

      expect(result.data).toEqual([]);
      expect(jobGets).toBe(0);
    });

    it('pages a search by offset instead of returning every match at once', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => summaryRow(i, { job_type: 'same_type' }));
      server.use(
        http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 50);
          return HttpResponse.json(rows.slice(offset, offset + limit), {
            headers: { 'X-Has-More': String(rows.length > offset + limit) },
          });
        })
      );

      const page1 = await jobsAPI.list({ job_type: 'same_type', per_page: 25 });
      expect(page1.data).toHaveLength(25);
      // The page proves one more row exists; the exact total comes from the stats query.
      expect(page1.total).toBe(26);
      expect(page1.total_pages).toBe(2);
      // ...but that 26 is a floor, not a count: it must not be printed as one.
      expect(page1.totalExact).toBe(false);
      expect(page1.hasMore).toBe(true);

      const page2 = await jobsAPI.list({ job_type: 'same_type', per_page: 25, page: 2 });
      expect(page2.data).toHaveLength(5);
      expect(page2.data[0].id).toBe('row-25');
      expect(page2.total).toBe(30);
      expect(page2.total_pages).toBe(2);
      expect(page2.totalExact).toBe(false);
      expect(page2.hasMore).toBe(false);
    });

    describe('filters an older server ignores (no X-Has-More)', () => {
      /** Backend 0.1.121: ignores q, job_type and the created window, sends no X-Has-More. */
      const useOldBackend = () => {
        const unfiltered = Array.from({ length: 5 }, (_, i) => summaryRow(i));
        server.use(http.get(`${API_BASE}/api/v1/jobs`, () => HttpResponse.json(unfiltered)));
      };

      it.each([
        ['a search', { search: 'send_email' }],
        ['a job type', { job_type: 'send_email' }],
        ['a start date', { created_after: '2026-10-01T00:00:00.000Z' }],
        ['an end date', { created_before: '2026-10-02T00:00:00.000Z' }],
        [
          'all of them with a queue and a status',
          { search: 'x', job_type: 'y', queue: 'q', status: 'pending' as const },
        ],
      ])('does not return the unfiltered rows as the results of %s', async (_name, params) => {
        useOldBackend();

        const result = await jobsAPI.list(params);

        expect(result.filtersUnsupported).toBe(true);
        expect(result.data).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.totalExact).toBe(false);
        expect(result.hasMore).toBe(false);
      });

      it('names the problem in one fixed sentence', () => {
        expect(JOBS_FILTER_UNSUPPORTED_MESSAGE).toBe(
          'This server version cannot filter by search, type or date yet'
        );
      });

      it.each([
        ['no filter', {}],
        ['a queue', { queue: 'default' }],
        ['a status', { status: 'pending' as const }],
        ['a tag', { tag: 'urgent' }],
      ])('keeps listing for %s: those work on every version', async (_name, params) => {
        useOldBackend();

        const result = await jobsAPI.list(params);

        expect(result.filtersUnsupported).toBe(false);
        expect(result.data).toHaveLength(5);
      });

      it('trusts a server that sends the header, even for a search with no match', async () => {
        server.use(
          http.get(`${API_BASE}/api/v1/jobs`, () =>
            HttpResponse.json([], { headers: { 'X-Has-More': 'false' } })
          )
        );

        const result = await jobsAPI.list({ search: 'nothing-matches' });

        expect(result.filtersUnsupported).toBe(false);
        expect(result.data).toEqual([]);
      });

      it('ignores whitespace-only filters, which are never sent', async () => {
        useOldBackend();

        const result = await jobsAPI.list({ search: '   ', job_type: ' ' });

        expect(result.filtersUnsupported).toBe(false);
        expect(result.data).toHaveLength(5);
      });
    });

    describe('has-more paging (X-Has-More)', () => {
      const limits: number[] = [];
      /** A backend with 30 rows whose responses carry (or lack) X-Has-More. */
      const useBackend = (sendHeader: boolean) => {
        limits.length = 0;
        const rows = Array.from({ length: 30 }, (_, i) => summaryRow(i));
        server.use(
          http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
            const url = new URL(request.url);
            const offset = Number(url.searchParams.get('offset') ?? 0);
            const limit = Number(url.searchParams.get('limit') ?? 50);
            limits.push(limit);
            return HttpResponse.json(rows.slice(offset, offset + limit), {
              headers: sendHeader ? { 'X-Has-More': String(rows.length > offset + limit) } : {},
            });
          })
        );
      };

      it('probes with one extra row until a response shows the header is readable', async () => {
        useBackend(true);

        const first = await jobsAPI.list({ per_page: 25 });
        const second = await jobsAPI.list({ per_page: 25 });
        const last = await jobsAPI.list({ per_page: 25, page: 2 });

        // First call: perPage + 1. Later calls trust the header and ask for exactly a page.
        expect(limits).toEqual([26, 25, 25]);
        expect(first.total).toBe(26);
        expect(second.total).toBe(26);
        expect(second.data).toHaveLength(25);
        // 5 rows left, header "false": the last page.
        expect(last.data).toHaveLength(5);
        expect(last.total).toBe(30);
        expect(last.total_pages).toBe(2);
        // Paging says what follows; it never claims to know the count.
        expect([first.hasMore, second.hasMore, last.hasMore]).toEqual([true, true, false]);
        expect([first.totalExact, second.totalExact, last.totalExact]).toEqual([
          false,
          false,
          false,
        ]);
      });

      it('takes "no more" from the header on an exactly full last page', async () => {
        limits.length = 0;
        const rows = Array.from({ length: 25 }, (_, i) => summaryRow(i));
        server.use(
          http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
            const limit = Number(new URL(request.url).searchParams.get('limit'));
            limits.push(limit);
            return HttpResponse.json(rows.slice(0, limit), {
              headers: { 'X-Has-More': String(rows.length > limit) },
            });
          })
        );

        await jobsAPI.list({ per_page: 25 }); // learns the header is readable
        const exact = await jobsAPI.list({ per_page: 25 });

        expect(limits).toEqual([26, 25]);
        // A page of exactly 25 rows and header "false": there is no page 2.
        expect(exact.data).toHaveLength(25);
        expect(exact.total).toBe(25);
        expect(exact.total_pages).toBe(1);
      });

      it('keeps probing with perPage + 1 when the header is absent (not exposed to the browser)', async () => {
        useBackend(false);

        const first = await jobsAPI.list({ per_page: 25 });
        const second = await jobsAPI.list({ per_page: 25 });
        const last = await jobsAPI.list({ per_page: 25, page: 2 });

        expect(limits).toEqual([26, 26, 26]);
        expect(first.total).toBe(26);
        expect(second.total).toBe(26);
        expect(last.data).toHaveLength(5);
        expect(last.total).toBe(30);
      });

      it('goes back to probing if the header stops arriving', async () => {
        useBackend(true);
        await jobsAPI.list({ per_page: 25 });
        await jobsAPI.list({ per_page: 25 }); // header mode: limit 25
        useBackend(false);
        const headerless = await jobsAPI.list({ per_page: 25 }); // limit 25, no header: cannot tell
        const probed = await jobsAPI.list({ per_page: 25 });

        expect(limits).toEqual([25, 26]);
        // A full page without an answer is treated as "maybe more", never as the end.
        expect(headerless.total).toBe(26);
        expect(probed.total).toBe(26);
      });

      it('cannot probe at the backend page cap, so a full page counts as maybe more', async () => {
        limits.length = 0;
        const rows = Array.from({ length: 150 }, (_, i) => summaryRow(i));
        server.use(
          http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
            const limit = Number(new URL(request.url).searchParams.get('limit'));
            limits.push(limit);
            return HttpResponse.json(rows.slice(0, limit));
          })
        );

        const result = await jobsAPI.list({ per_page: 100 });

        // limit 101 would be clamped to 100 by the backend, so a probe row could never arrive.
        expect(limits).toEqual([100]);
        expect(result.data).toHaveLength(100);
        expect(result.total).toBe(101);
        expect(result.hasMore).toBe(true);
      });

      it('offers no next page past the page cap, however many rows follow', async () => {
        const rows = Array.from({ length: 30 }, (_, i) => summaryRow(i));
        server.use(
          http.get(`${API_BASE}/api/v1/jobs`, () =>
            HttpResponse.json(rows, { headers: { 'X-Has-More': 'true' } })
          )
        );

        const deepest = await jobsAPI.list({ per_page: 25, page: JOBS_LIST_MAX_PAGE + 50 });

        expect(deepest.page).toBe(JOBS_LIST_MAX_PAGE);
        expect(deepest.hasMore).toBe(false);
      });
    });
  });

  describe('getHistory', () => {
    it('maps the job_history rows', async () => {
      const page = await jobsAPI.getHistory('job-1');

      expect(page.events.map((e) => e.event_type)).toEqual([
        'processing',
        'retry_scheduled',
        'processing',
        'completed',
      ]);
      expect(page.events[0]).toMatchObject({
        id: 'hist-1',
        job_id: 'job-1',
        worker_id: 'worker-1',
        created_at: '2024-01-01T00:00:10Z',
      });
      expect(page.events[1].details).toMatchObject({ error: 'Connection refused', retry_count: 1 });
      expect(page.hasMore).toBe(false);
    });

    it('is empty for a job without recorded events', async () => {
      const page = await jobsAPI.getHistory('job-2');
      expect(page.events).toEqual([]);
    });

    it('sends order_dir, limit and offset', async () => {
      let seen: URLSearchParams | undefined;
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/:id/history`, ({ request }) => {
          seen = new URL(request.url).searchParams;
          return HttpResponse.json([], { headers: { 'X-Has-More': 'true' } });
        })
      );

      const page = await jobsAPI.getHistory('job-1', { order_dir: 'desc', limit: 10, offset: 20 });

      expect(seen?.get('order_dir')).toBe('desc');
      expect(seen?.get('limit')).toBe('10');
      expect(seen?.get('offset')).toBe('20');
      expect(page.hasMore).toBe(true);
    });

    it('reports hasMore as unknown when the header is not readable', async () => {
      server.use(http.get(`${API_BASE}/api/v1/jobs/:id/history`, () => HttpResponse.json([])));
      expect((await jobsAPI.getHistory('job-1')).hasMore).toBeUndefined();
    });

    it('normalises a null worker_id and non-object details', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/jobs/:id/history`, () =>
          HttpResponse.json([
            {
              id: 'h1',
              job_id: 'job-1',
              event_type: 'created',
              worker_id: null,
              details: null,
              created_at: '2024-01-01T00:00:00Z',
            },
          ])
        )
      );
      const [event] = (await jobsAPI.getHistory('job-1')).events;
      expect(event.worker_id).toBeNull();
      expect(event.details).toEqual({});
    });

    it('rejects with a 404 APIError for an unknown job (or a backend without the route)', async () => {
      const error = await jobsAPI.getHistory('nope').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).isNotFound()).toBe(true);
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
    const page = (total: number, totalPages: number): JobListPage => ({
      data: [],
      page: 1,
      per_page: 25,
      total,
      total_pages: totalPages,
      totalExact: false,
      hasMore: true,
      filtersUnsupported: false,
    });

    it('raises the total and page count to the exact figure', () => {
      const result = withExactTotal(page(26, 2), 4000);
      expect(result.total).toBe(4000);
      expect(result.total_pages).toBe(160);
    });

    it('is the only thing that makes a total exact', () => {
      expect(page(26, 2).totalExact).toBe(false);
      expect(withExactTotal(page(26, 2), 4000).totalExact).toBe(true);
      expect(withExactTotal(page(26, 2), 10).totalExact).toBe(true);
      expect(withExactTotal(page(26, 2), undefined).totalExact).toBe(false);
      expect(withExactTotal(page(26, 2), Number.NaN).totalExact).toBe(false);
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
