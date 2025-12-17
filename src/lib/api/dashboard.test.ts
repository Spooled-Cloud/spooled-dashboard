/**
 * Tests for Dashboard API
 */

import { describe, it, expect } from 'vitest';
import { dashboardAPI } from './dashboard';

describe('dashboardAPI', () => {
  describe('getOverview', () => {
    it('should fetch dashboard data', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result).toBeDefined();
    });

    it('should return system info', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.system).toBeDefined();
      expect(result.system.version).toBeDefined();
    });

    it('should return job statistics', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.jobs).toBeDefined();
      expect(result.jobs.total).toBeDefined();
      expect(result.jobs.pending).toBeDefined();
      expect(result.jobs.processing).toBeDefined();
    });

    it('should return queue summaries', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.queues).toBeDefined();
      expect(Array.isArray(result.queues)).toBe(true);
    });

    it('should return worker status', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.workers).toBeDefined();
      expect(result.workers.total).toBeDefined();
    });

    it('should return recent activity', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.recent_activity).toBeDefined();
      expect(result.recent_activity.jobs_created_1h).toBeDefined();
    });
  });
});

describe('DashboardData structure', () => {
  it('should have correct system_info structure', () => {
    const system = {
      version: '1.0.0',
      uptime_seconds: 86400,
      started_at: '2024-01-01T00:00:00Z',
      database_status: 'ok',
      cache_status: 'ok',
      environment: 'production',
    };

    expect(system.version).toBe('1.0.0');
    expect(system.uptime_seconds).toBe(86400);
  });

  it('should have correct job_statistics structure', () => {
    const jobs = {
      total: 1000,
      pending: 50,
      processing: 10,
      completed_24h: 900,
      failed_24h: 30,
      deadletter: 5,
      avg_wait_time_ms: 250,
      avg_processing_time_ms: 1500,
    };

    expect(jobs.total).toBe(1000);
    expect(jobs.completed_24h).toBe(900);
    expect(jobs.avg_processing_time_ms).toBe(1500);
  });

  it('should have correct queue_summaries structure', () => {
    const queueSummary = {
      name: 'default',
      pending: 30,
      processing: 5,
      paused: false,
    };

    expect(queueSummary.name).toBe('default');
    expect(queueSummary.paused).toBe(false);
  });

  it('should have correct worker_status structure', () => {
    const workers = {
      total: 10,
      healthy: 8,
      unhealthy: 2,
    };

    expect(workers.total).toBe(10);
    expect(workers.healthy).toBe(8);
    expect(workers.unhealthy).toBe(2);
  });

  it('should have correct recent_activity structure', () => {
    const activity = {
      jobs_created_1h: 120,
      jobs_completed_1h: 110,
      jobs_failed_1h: 5,
    };

    expect(activity.jobs_created_1h).toBe(120);
    expect(activity.jobs_completed_1h).toBe(110);
    expect(activity.jobs_failed_1h).toBe(5);
  });
});
