/**
 * Dashboard Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api/dashboard';
import { queryKeys } from '@/lib/query-client';
import type { DashboardData } from '@/lib/types';

/**
 * Normalize dashboard data from API response
 * Maps backend field names to frontend-friendly names
 */
function normalizeDashboardData(data: DashboardData): DashboardData {
  // Calculate success rate from completed vs failed
  const completed = data.jobs?.completed_24h ?? 0;
  const failed = data.jobs?.failed_24h ?? 0;
  const totalProcessed = completed + failed;
  const successRate = totalProcessed > 0 ? (completed / totalProcessed) * 100 : 100;

  return {
    ...data,
    // Map to legacy field names for backward compatibility with UI components
    system_info: data.system_info ?? {
      version: data.system?.version ?? 'unknown',
      uptime_seconds: data.system?.uptime_seconds ?? 0,
      rust_version: data.system?.environment ?? 'unknown',
    },
    job_statistics: data.job_statistics ?? {
      total: data.jobs?.total ?? 0,
      pending: data.jobs?.pending ?? 0,
      processing: data.jobs?.processing ?? 0,
      completed: data.jobs?.completed_24h ?? 0,
      failed: data.jobs?.failed_24h ?? 0,
      cancelled: 0,
      deadletter: data.jobs?.deadletter ?? 0,
      success_rate: successRate,
      avg_processing_time_ms: data.jobs?.avg_processing_time_ms ?? 0,
    },
    queue_summaries:
      data.queue_summaries ??
      data.queues?.map((q) => ({
        name: q.name,
        pending: q.pending,
        processing: q.processing,
        completed: 0,
        failed: 0,
        paused: q.paused,
      })) ??
      [],
    worker_status: data.worker_status ?? {
      total: data.workers?.total ?? 0,
      active: data.workers?.healthy ?? 0,
      idle: data.workers?.unhealthy ?? 0,
      offline: 0,
    },
  };
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: async () => {
      const data = await dashboardAPI.getOverview();
      return normalizeDashboardData(data);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
