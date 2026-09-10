import { describe, expect, it } from 'vitest';
import { normalizeDashboardData } from './useDashboard';
import type { DashboardData } from '@/lib/types';

function overview(unhealthy: number, healthy = 3): DashboardData {
  return {
    system: {
      version: '0.1.0',
      uptime_seconds: 1,
      started_at: '2024-01-01T00:00:00Z',
      database_status: 'healthy',
      cache_status: 'healthy',
      environment: 'test',
    },
    jobs: {
      total: 0,
      pending: 0,
      processing: 0,
      completed_24h: 0,
      failed_24h: 0,
      deadletter: 0,
      avg_wait_time_ms: null,
      avg_processing_time_ms: null,
    },
    queues: [],
    workers: {
      total: healthy + unhealthy,
      healthy,
      unhealthy,
    },
    recent_activity: {
      jobs_created_1h: 0,
      jobs_completed_1h: 0,
      jobs_failed_1h: 0,
    },
  };
}

describe('normalizeDashboardData', () => {
  it('does not map unhealthy workers onto idle', () => {
    const mapped = normalizeDashboardData(overview(2, 3));
    expect(mapped.worker_status).toEqual({
      total: 5,
      active: 3,
      idle: 0,
      offline: 2,
    });
  });

  it('keeps an explicit worker_status from the caller', () => {
    const mapped = normalizeDashboardData({
      ...overview(2, 3),
      worker_status: { total: 4, active: 1, idle: 2, offline: 1 },
    });
    expect(mapped.worker_status).toEqual({
      total: 4,
      active: 1,
      idle: 2,
      offline: 1,
    });
  });
});
