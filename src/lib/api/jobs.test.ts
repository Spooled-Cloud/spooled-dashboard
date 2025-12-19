/**
 * Tests for Jobs API
 */

import { describe, it, expect } from 'vitest';
import { jobsAPI } from './jobs';

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
      expect(stats.total).toBeDefined();
      expect(stats.pending).toBeDefined();
      expect(stats.completed).toBeDefined();
    });
  });

  describe('getStatusCounts', () => {
    it('should fetch job status counts', async () => {
      const counts = await jobsAPI.getStatusCounts();
      expect(counts).toBeDefined();
      expect(counts.pending).toBeDefined();
      expect(counts.completed).toBeDefined();
    });
  });
});
