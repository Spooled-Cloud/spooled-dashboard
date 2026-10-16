/**
 * Tests for Workers API Module
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { workersAPI, workerSuccessRate } from './workers';
import {
  mockWorkersSummary,
  mockWorkerDetails,
  withoutWorkerCounters,
} from '@/test/mocks/handlers';

const API_BASE = 'https://api.spooled.cloud';

describe('workersAPI', () => {
  describe('list', () => {
    it('should list all workers', async () => {
      const workers = await workersAPI.list();

      expect(Array.isArray(workers)).toBe(true);
      expect(workers.length).toBeGreaterThan(0);
    });

    it('should return workers with required fields', async () => {
      const workers = await workersAPI.list();
      const worker = workers[0];

      expect(worker).toHaveProperty('id');
      expect(worker).toHaveProperty('hostname');
      expect(worker).toHaveProperty('status');
    });

    it('maps healthy with no current jobs to idle', async () => {
      const workers = await workersAPI.list();
      expect(workers.find((w) => w.id === 'worker-1')?.status).toBe('active');
      expect(workers.find((w) => w.id === 'worker-2')?.status).toBe('idle');
    });

    it('keeps a degraded worker degraded on the list and the detail', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/workers`, () =>
          HttpResponse.json([
            {
              ...mockWorkersSummary[0],
              id: 'worker-hot',
              status: 'degraded',
              current_jobs: 10,
            },
          ])
        ),
        http.get(`${API_BASE}/api/v1/workers/:id`, () =>
          HttpResponse.json({
            ...mockWorkerDetails['worker-1'],
            id: 'worker-hot',
            status: 'degraded',
            current_jobs: 10,
          })
        )
      );

      const [summary] = await workersAPI.list();
      const detail = await workersAPI.get('worker-hot');
      expect(summary.status).toBe('degraded');
      expect(detail.status).toBe('degraded');
    });
  });

  describe('list summary fields', () => {
    it('does not present the last heartbeat as the start time', async () => {
      const workers = await workersAPI.list();
      for (const w of workers) {
        expect(w.started_at).toBeUndefined();
        expect(w.started_at).not.toBe(w.last_heartbeat);
      }
    });

    it('maps jobs_processed and jobs_failed from the list and the detail (backend 0.1.122)', async () => {
      const [summary] = await workersAPI.list();
      const detail = await workersAPI.get('worker-1');
      for (const w of [summary, detail]) {
        expect(w.jobs_processed).toBe(1280);
        expect(w.jobs_failed).toBe(20);
      }
    });

    it('keeps a real 0 from the backend as 0', async () => {
      const workers = await workersAPI.list();
      const idle = workers.find((w) => w.id === 'worker-2');
      expect(idle?.jobs_processed).toBe(0);
      expect(idle?.jobs_failed).toBe(0);
    });

    it('leaves the counters undefined when the backend does not send them (0.1.121)', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/workers`, () =>
          HttpResponse.json(mockWorkersSummary.map(withoutWorkerCounters))
        ),
        http.get(`${API_BASE}/api/v1/workers/:id`, () =>
          HttpResponse.json(withoutWorkerCounters(mockWorkerDetails['worker-1']))
        )
      );
      const [summary] = await workersAPI.list();
      const detail = await workersAPI.get('worker-1');
      for (const w of [summary, detail]) {
        expect(w.jobs_processed).toBeUndefined();
        expect(w.jobs_failed).toBeUndefined();
      }
    });

    it('ignores a counter that is not a non-negative number', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/workers`, () =>
          HttpResponse.json([{ ...mockWorkersSummary[0], jobs_processed: '12', jobs_failed: -1 }])
        )
      );
      const [worker] = await workersAPI.list();
      expect(worker.jobs_processed).toBeUndefined();
      expect(worker.jobs_failed).toBeUndefined();
    });
  });

  describe('workerSuccessRate', () => {
    it('is processed / (processed + failed) in percent', () => {
      expect(workerSuccessRate({ jobs_processed: 90, jobs_failed: 10 })).toBe(90);
      expect(workerSuccessRate({ jobs_processed: 0, jobs_failed: 4 })).toBe(0);
      expect(workerSuccessRate({ jobs_processed: 7, jobs_failed: 0 })).toBe(100);
    });

    it('is undefined before the worker finished anything, or without counters', () => {
      expect(workerSuccessRate({ jobs_processed: 0, jobs_failed: 0 })).toBeUndefined();
      expect(workerSuccessRate({})).toBeUndefined();
      expect(workerSuccessRate({ jobs_processed: 5 })).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should get a single worker by id', async () => {
      const worker = await workersAPI.get('worker-1');

      expect(worker).toHaveProperty('id');
      expect(worker.id).toBe('worker-1');
    });

    it('maps WorkerResponse field names, not the DB Worker row', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/workers/:id`, () => {
          return HttpResponse.json({
            id: 'worker-live',
            organization_id: 'org-1',
            queue_name: 'default',
            queue_names: ['default', 'emails'],
            hostname: 'box-1',
            worker_type: 'http',
            max_concurrency: 8,
            current_jobs: 2,
            status: 'healthy',
            last_heartbeat: '2026-09-09T12:00:00Z',
            metadata: {},
            version: '1.1.0',
            registered_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-09T12:00:00Z',
          });
        })
      );

      const worker = await workersAPI.get('worker-live');
      expect(worker.concurrency).toBe(8);
      expect(worker.current_jobs).toBe(2);
      expect(worker.started_at).toBe('2026-09-01T00:00:00Z');
      expect(worker.queues).toEqual(['default', 'emails']);
      expect(worker.status).toBe('active');
    });
  });

  describe('deregister', () => {
    it('should deregister a worker', async () => {
      await expect(workersAPI.deregister('worker-1')).resolves.not.toThrow();
    });
  });
});
