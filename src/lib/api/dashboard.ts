/**
 * Dashboard API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { DashboardData } from '@/lib/types';

export const dashboardAPI = {
  /**
   * GET /api/v1/dashboard
   * Returns comprehensive dashboard data
   */
  getOverview: (): Promise<DashboardData> => {
    return apiClient.get<DashboardData>(API_ENDPOINTS.DASHBOARD);
  },
};
