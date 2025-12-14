/**
 * Usage API client
 *
 * Fetches organization usage and plan limits for the user dashboard.
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';

// Types matching backend UsageInfo struct
export interface UsageInfo {
  plan: string;
  plan_display_name: string;
  limits: PlanLimits;
  usage: ResourceUsage;
  warnings: UsageWarning[];
}

export interface PlanLimits {
  tier: string;
  display_name: string;
  max_jobs_per_day: number | null;
  max_active_jobs: number | null;
  max_queues: number | null;
  max_workers: number | null;
  max_api_keys: number | null;
  max_schedules: number | null;
  max_workflows: number | null;
  max_webhooks: number | null;
  max_payload_size_bytes: number;
  rate_limit_requests_per_second: number;
  rate_limit_burst: number;
  job_retention_days: number;
  history_retention_days: number;
}

export interface ResourceUsage {
  jobs_today: UsageItem;
  active_jobs: UsageItem;
  queues: UsageItem;
  workers: UsageItem;
  api_keys: UsageItem;
  schedules: UsageItem;
  workflows: UsageItem;
  webhooks: UsageItem;
}

export interface UsageItem {
  current: number;
  limit: number | null;
  percentage: number | null;
  is_disabled: boolean;
}

export interface UsageWarning {
  resource: string;
  message: string;
  severity: 'warning' | 'critical';
}

export const usageAPI = {
  /**
   * Get current organization's usage and limits
   */
  async getUsage(): Promise<UsageInfo> {
    return apiClient.get<UsageInfo>(API_ENDPOINTS.ORGANIZATIONS.USAGE);
  },
};
