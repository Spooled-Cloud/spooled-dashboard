/**
 * Tests for Queues API
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { queuesAPI } from './queues';

const API_BASE = 'https://api.spooled.cloud';

describe('queuesAPI', () => {
  describe('list', () => {
    it('should fetch queues list', async () => {
      const queues = await queuesAPI.list();
      expect(queues).toBeDefined();
      expect(Array.isArray(queues)).toBe(true);
      expect(queues.length).toBeGreaterThan(0);
    });

    it('should return queue objects with expected properties', async () => {
      const queues = await queuesAPI.list();
      const queue = queues[0];
      expect(queue.name).toBeDefined();
      expect(queue.max_retries).toBeDefined();
      expect(queue.job_timeout_ms).toBeDefined();
    });
  });

  describe('unenforced settings', () => {
    it('does not invent concurrency or retry delay for list summaries', async () => {
      const [queue] = await queuesAPI.list();
      expect(queue.concurrency).toBeUndefined();
      expect(queue.retry_delay_ms).toBeUndefined();
      expect(queue.backoff_multiplier).toBeUndefined();
      expect(queue.max_retry_delay_ms).toBeUndefined();
    });

    it('does not default settings a queue config response omits', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/queues/:name`, ({ params }) =>
          HttpResponse.json({
            id: 'q',
            organization_id: 'org-1',
            queue_name: params.name,
            max_retries: 3,
            default_timeout: 300,
            enabled: true,
            settings: {},
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
          })
        )
      );
      const queue = await queuesAPI.get('bare');
      expect(queue.concurrency).toBeUndefined();
      expect(queue.retry_delay_ms).toBeUndefined();
      expect(queue.backoff_multiplier).toBeUndefined();
      expect(queue.max_retry_delay_ms).toBeUndefined();
    });

    it('does not invent them when pausing or resuming', async () => {
      for (const queue of [await queuesAPI.pause('default'), await queuesAPI.resume('default')]) {
        expect(queue.concurrency).toBeUndefined();
        expect(queue.retry_delay_ms).toBeUndefined();
        expect(queue.backoff_multiplier).toBeUndefined();
        expect(queue.max_retry_delay_ms).toBeUndefined();
      }
    });
  });

  describe('get', () => {
    it('should fetch a single queue by name', async () => {
      const queue = await queuesAPI.get('default');
      expect(queue).toBeDefined();
      expect(queue.name).toBe('default');
      expect(queue.concurrency).toBeDefined();
    });

    it('should throw error for non-existent queue', async () => {
      await expect(queuesAPI.get('non-existent')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('does not invent concurrency or retry-delay settings the caller did not set', async () => {
      let body: { settings?: Record<string, unknown> } = {};
      server.use(
        http.put(`${API_BASE}/api/v1/queues/:name/config`, async ({ request }) => {
          body = (await request.json()) as typeof body;
          return HttpResponse.json(
            {
              id: 'q',
              organization_id: 'org-1',
              queue_name: 'plain',
              max_retries: 3,
              default_timeout: 300,
              enabled: true,
              settings: {},
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-01T00:00:00Z',
            },
            { status: 201 }
          );
        })
      );
      await queuesAPI.create({ name: 'plain' });
      expect(body.settings).toEqual({});
    });

    it('should create a new queue', async () => {
      const newQueue = await queuesAPI.create({
        name: 'test-queue',
        description: 'A test queue',
        concurrency: 5,
      });

      expect(newQueue).toBeDefined();
      expect(newQueue.name).toBe('test-queue');
      expect(newQueue.concurrency).toBe(5);
    });

    it('should create queue with all optional parameters', async () => {
      const newQueue = await queuesAPI.create({
        name: 'full-queue',
        description: 'Full config queue',
        concurrency: 10,
        max_retries: 5,
        retry_delay_ms: 2000,
        backoff_multiplier: 2,
        max_retry_delay_ms: 30000,
        job_timeout_ms: 120000,
      });

      expect(newQueue).toBeDefined();
      expect(newQueue.name).toBe('full-queue');
    });

    it('rejects a timeout that is not a whole number of seconds', async () => {
      let posted = false;
      server.use(
        http.put(`${API_BASE}/api/v1/queues/:name/config`, async () => {
          posted = true;
          return HttpResponse.json({}, { status: 500 });
        })
      );

      await expect(
        queuesAPI.create({ name: 'timeout-queue', job_timeout_ms: 500 })
      ).rejects.toThrow(/whole number of seconds/);
      await expect(
        queuesAPI.create({ name: 'timeout-queue', job_timeout_ms: 1500 })
      ).rejects.toThrow(/whole number of seconds/);
      await expect(queuesAPI.create({ name: 'timeout-queue', job_timeout_ms: 0 })).rejects.toThrow(
        /whole number of seconds/
      );
      expect(posted).toBe(false);
    });

    it('stores a whole-second timeout as seconds', async () => {
      let posted: Record<string, unknown> | undefined;
      server.use(
        http.put(`${API_BASE}/api/v1/queues/:name/config`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'queue-timeout',
            organization_id: 'org-1',
            queue_name: 'timeout-queue',
            max_retries: 3,
            default_timeout: posted.default_timeout ?? 2,
            rate_limit: null,
            enabled: true,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        })
      );

      await queuesAPI.create({
        name: 'timeout-queue',
        job_timeout_ms: 2000,
      });

      expect(posted?.default_timeout).toBe(2);
      expect(posted).not.toHaveProperty('job_timeout_ms');
    });
  });

  describe('update', () => {
    it('should update a queue', async () => {
      const updated = await queuesAPI.update('default', {
        concurrency: 20,
      });

      expect(updated).toBeDefined();
      expect(updated.concurrency).toBe(20);
    });

    it('rejects a timeout that is not a whole number of seconds', async () => {
      let posted = false;
      server.use(
        http.put(`${API_BASE}/api/v1/queues/default/config`, async () => {
          posted = true;
          return HttpResponse.json({}, { status: 500 });
        })
      );

      await expect(queuesAPI.update('default', { job_timeout_ms: 1500 })).rejects.toThrow(
        /whole number of seconds/
      );
      expect(posted).toBe(false);
    });

    it('should update queue with multiple fields', async () => {
      const updated = await queuesAPI.update('default', {
        concurrency: 15,
        description: 'Updated description',
        max_retries: 5,
      });

      expect(updated).toBeDefined();
      expect(updated.concurrency).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete a queue', async () => {
      const result = await queuesAPI.delete('test-queue');
      expect(result).toBeUndefined(); // 204 No Content
    });
  });

  describe('pause', () => {
    it('should pause a queue', async () => {
      const result = await queuesAPI.pause('default');
      expect(result).toBeDefined();
      expect(result.paused).toBe(true);
    });
  });

  describe('resume', () => {
    it('should resume a queue', async () => {
      const result = await queuesAPI.resume('default');
      expect(result).toBeDefined();
      expect(result.paused).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should fetch queue statistics', async () => {
      const stats = await queuesAPI.getStats('default');
      expect(stats).toBeDefined();
      expect(stats.name).toBe('default');
      expect(stats.pending).toBeDefined();
      expect(stats.processing).toBeDefined();
      expect(stats.completed).toBeDefined();
      expect(stats.failed).toBeDefined();
    });

    it('uses the backend deadletter_jobs count instead of a hard-coded zero', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
          HttpResponse.json({
            queue_name: params.name,
            pending_jobs: 1,
            processing_jobs: 0,
            completed_jobs_24h: 10,
            failed_jobs_24h: 4,
            deadletter_jobs: 7,
            avg_processing_time_ms: 100,
            max_job_age_seconds: 1,
            active_workers: 1,
          })
        )
      );
      const stats = await queuesAPI.getStats('default');
      expect(stats.deadletter).toBe(7);
      expect(stats.failed).toBe(4);
    });

    it('leaves deadletter undefined when the backend does not report deadletter_jobs', async () => {
      // Backend 0.1.120 has no deadletter_jobs field (it arrives in 0.1.121): an absent
      // count must stay "unknown", never become a confident 0.
      server.use(
        http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
          HttpResponse.json({
            queue_name: params.name,
            pending_jobs: 1,
            processing_jobs: 0,
            completed_jobs_24h: 10,
            failed_jobs_24h: 4,
            avg_processing_time_ms: 100,
            max_job_age_seconds: 1,
            active_workers: 1,
          })
        )
      );
      const stats = await queuesAPI.getStats('default');
      expect(stats.deadletter).toBeUndefined();
      expect(stats.failed).toBe(4);
    });

    it('keeps a reported deadletter_jobs of 0 as 0', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
          HttpResponse.json({
            queue_name: params.name,
            pending_jobs: 0,
            processing_jobs: 0,
            completed_jobs_24h: 0,
            failed_jobs_24h: 0,
            deadletter_jobs: 0,
            active_workers: 0,
          })
        )
      );
      const stats = await queuesAPI.getStats('default');
      expect(stats.deadletter).toBe(0);
    });
  });
});
