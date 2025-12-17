/**
 * Admin API client
 *
 * All admin endpoints require the X-Admin-Key header.
 * The admin key is stored in sessionStorage after login.
 */

import { API_BASE_URL } from '@/lib/constants/api';

// ============================================================================
// Types
// ============================================================================

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
  usage: AdminUsageStats;
}

export interface AdminUsageStats {
  jobs_today: number;
  active_jobs: number;
  queues: number;
  workers: number;
  api_keys: number;
}

export interface AdminOrganizationDetail extends AdminOrganization {
  settings: Record<string, unknown>;
  custom_limits: Partial<PlanLimits> | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  stripe_cancel_at_period_end: boolean | null;
  usage_info: UsageInfo;
  api_keys_count: number;
  total_jobs: number;
}

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

export interface ListOrgsResponse {
  organizations: AdminOrganization[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListOrgsParams {
  plan_tier?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface UpdateOrgRequest {
  plan_tier?: string;
  billing_email?: string;
  settings?: Record<string, unknown>;
  custom_limits?: Partial<PlanLimits> | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export interface CreateOrgRequest {
  name: string;
  slug: string;
  billing_email?: string;
  plan_tier?: string;
}

export interface CreateOrgResponse {
  organization: AdminOrganization;
  api_key: {
    id: string;
    key: string;
    name: string;
    created_at: string;
  };
}

export interface CreateApiKeyRequest {
  name: string;
  queues?: string[];
}

export interface CreateApiKeyResponse {
  id: string;
  key: string;
  name: string;
  created_at: string;
}

export interface PlatformStats {
  organizations: {
    total: number;
    by_plan: Array<{ plan: string; count: number }>;
    created_today: number;
    created_this_week: number;
  };
  jobs: {
    total_active: number;
    pending: number;
    processing: number;
    completed_24h: number;
    failed_24h: number;
  };
  workers: {
    total: number;
    healthy: number;
    degraded: number;
  };
  system: {
    api_version: string;
    uptime_seconds: number;
  };
}

// ============================================================================
// Admin Key Management
// ============================================================================

/**
 * SECURITY CONSIDERATIONS:
 *
 * The admin key is stored in sessionStorage rather than localStorage:
 * - sessionStorage is cleared when the browser tab closes (limits exposure window)
 * - Unlike localStorage, it's not shared across tabs (limits attack surface)
 *
 * However, sessionStorage is still accessible to JavaScript, making it vulnerable
 * to XSS attacks. For maximum security, consider:
 * - Using httpOnly cookies (requires backend changes)
 * - Implementing short session timeouts
 * - Adding CSP headers to prevent XSS
 *
 * Current tradeoff: Convenience (admin stays logged in within tab) vs. security
 */
const ADMIN_KEY_STORAGE = 'spooled_admin_key';

export function getAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setAdminKey(key: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminKey();
}

// ============================================================================
// Admin API Client
// ============================================================================

class AdminAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'AdminAPIError';
  }
}

async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const adminKey = getAdminKey();
  if (!adminKey) {
    throw new AdminAPIError('Admin key not set', 401, 'missing_admin_key');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': adminKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new AdminAPIError(
      error.message || `Request failed: ${response.status}`,
      response.status,
      error.error
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// API Functions
// ============================================================================

export const adminAPI = {
  /**
   * Verify admin key is valid by making a test request
   */
  async verifyKey(key: string): Promise<boolean> {
    const url = `${API_BASE_URL}/api/v1/admin/stats`;
    try {
      const response = await fetch(url, {
        headers: {
          'X-Admin-Key': key,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * List all organizations
   */
  async listOrganizations(params: ListOrgsParams = {}): Promise<ListOrgsResponse> {
    const searchParams = new URLSearchParams();
    if (params.plan_tier) searchParams.set('plan_tier', params.plan_tier);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);

    const query = searchParams.toString();
    const endpoint = `/api/v1/admin/organizations${query ? `?${query}` : ''}`;
    return adminFetch<ListOrgsResponse>(endpoint);
  },

  /**
   * Get organization details
   */
  async getOrganization(id: string): Promise<AdminOrganizationDetail> {
    return adminFetch<AdminOrganizationDetail>(`/api/v1/admin/organizations/${id}`);
  },

  /**
   * Update organization
   */
  async updateOrganization(id: string, data: UpdateOrgRequest): Promise<AdminOrganization> {
    return adminFetch<AdminOrganization>(`/api/v1/admin/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete organization
   */
  async deleteOrganization(id: string, hardDelete = false): Promise<void> {
    const query = hardDelete ? '?hard_delete=true' : '';
    return adminFetch<void>(`/api/v1/admin/organizations/${id}${query}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get platform statistics
   */
  async getStats(): Promise<PlatformStats> {
    return adminFetch<PlatformStats>('/api/v1/admin/stats');
  },

  /**
   * Get all plan tiers with limits
   */
  async getPlans(): Promise<PlanLimits[]> {
    return adminFetch<PlanLimits[]>('/api/v1/admin/plans');
  },

  /**
   * Create a new organization (admin-only)
   */
  async createOrganization(data: CreateOrgRequest): Promise<CreateOrgResponse> {
    return adminFetch<CreateOrgResponse>('/api/v1/admin/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Create an API key for an organization
   */
  async createApiKey(orgId: string, data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return adminFetch<CreateApiKeyResponse>(`/api/v1/admin/organizations/${orgId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Reset usage counters for an organization
   */
  async resetUsage(orgId: string): Promise<void> {
    return adminFetch<void>(`/api/v1/admin/organizations/${orgId}/reset-usage`, {
      method: 'POST',
    });
  },
};
