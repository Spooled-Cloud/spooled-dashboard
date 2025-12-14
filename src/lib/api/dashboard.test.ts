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
      expect(result.system_info).toBeDefined();
      expect(result.system_info.version).toBeDefined();
    });

    it('should return job statistics', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.job_statistics).toBeDefined();
      expect(result.job_statistics.total).toBeDefined();
      expect(result.job_statistics.pending).toBeDefined();
      expect(result.job_statistics.completed).toBeDefined();
    });

    it('should return queue summaries', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.queue_summaries).toBeDefined();
      expect(Array.isArray(result.queue_summaries)).toBe(true);
    });

    it('should return worker status', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.worker_status).toBeDefined();
      expect(result.worker_status.total).toBeDefined();
      expect(result.worker_status.active).toBeDefined();
    });

    it('should return recent activity', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.recent_activity).toBeDefined();
      expect(Array.isArray(result.recent_activity)).toBe(true);
    });

    it('should return processing rate', async () => {
      const result = await dashboardAPI.getOverview();
      expect(result.processing_rate).toBeDefined();
      expect(Array.isArray(result.processing_rate)).toBe(true);
    });
  });
});

describe('DashboardData structure', () => {
  it('should have correct system_info structure', () => {
    const systemInfo = {
      version: '1.0.0',
      uptime_seconds: 86400,
      rust_version: '1.75.0',
    };

    expect(systemInfo.version).toBe('1.0.0');
    expect(systemInfo.uptime_seconds).toBe(86400);
  });

  it('should have correct job_statistics structure', () => {
    const jobStats = {
      total: 1000,
      pending: 50,
      processing: 10,
      completed: 900,
      failed: 30,
      cancelled: 5,
      deadletter: 5,
      success_rate: 96.8,
      avg_processing_time_ms: 1500,
    };

    expect(jobStats.total).toBe(1000);
    expect(jobStats.success_rate).toBe(96.8);
    expect(jobStats.avg_processing_time_ms).toBe(1500);
  });

  it('should have correct queue_summaries structure', () => {
    const queueSummary = {
      name: 'default',
      pending: 30,
      processing: 5,
      completed: 500,
      failed: 10,
      paused: false,
    };

    expect(queueSummary.name).toBe('default');
    expect(queueSummary.paused).toBe(false);
  });

  it('should have correct worker_status structure', () => {
    const workerStatus = {
      total: 10,
      active: 8,
      idle: 2,
      offline: 0,
    };

    expect(workerStatus.total).toBe(10);
    expect(workerStatus.active).toBe(8);
    expect(workerStatus.idle).toBe(2);
  });

  it('should have correct recent_activity structure', () => {
    const activity = {
      type: 'job.completed',
      job_id: 'job-1',
      queue: 'default',
      timestamp: '2024-01-01T12:00:00Z',
    };

    expect(activity.type).toBe('job.completed');
    expect(activity.job_id).toBe('job-1');
    expect(activity.queue).toBe('default');
  });

  it('should have correct processing_rate structure', () => {
    const rate = {
      timestamp: '2024-01-01T12:00:00Z',
      jobs_per_second: 5.2,
    };

    expect(rate.timestamp).toBeDefined();
    expect(rate.jobs_per_second).toBe(5.2);
  });
});
