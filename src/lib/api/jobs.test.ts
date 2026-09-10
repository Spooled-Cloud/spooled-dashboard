/**
 * Tests for Jobs API
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { jobsAPI } from './jobs';

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

  describe('cancel', () => {
    it('should cancel a pending job', async () => {
      // cancel uses DELETE endpoint which returns void
      await expect(jobsAPI.cancel('job-2')).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete a job', async () => {
      await expect(jobsAPI.delete('job-1')).resolves.toBeUndefined();
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
