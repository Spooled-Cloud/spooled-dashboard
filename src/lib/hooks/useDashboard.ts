/**
 * Dashboard Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api/dashboard';
import { queryKeys } from '@/lib/query-client';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: () => dashboardAPI.getOverview(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
