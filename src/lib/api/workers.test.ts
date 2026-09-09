/**
 * Tests for Workers API Module
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { workersAPI } from './workers';

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
