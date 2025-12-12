/**
 * API Keys API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';

export interface APIKey {
  id: string;
  name: string;
  queues: string[];
  rate_limit: number | null;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
  expires_at: string | null;
}

/** Helper to derive display status from API key fields */
export function getApiKeyStatus(key: APIKey): 'active' | 'revoked' | 'expired' {
  if (!key.is_active) return 'revoked';
  if (key.expires_at && new Date(key.expires_at) < new Date()) return 'expired';
  return 'active';
}

/** Get key prefix from queues for display (shows first queue or *) */
export function getKeyDisplayPrefix(key: APIKey): string {
  if (key.queues.length === 0) return 'none';
  if (key.queues[0] === '*') return 'all queues';
  return key.queues[0];
}

export interface CreateAPIKeyRequest {
  name: string;
  permissions: string[];
  expires_at?: string;
}

export interface CreateAPIKeyResponse {
  id: string;
  name: string;
  key: string; // Full key, only shown once!
  key_prefix: string;
  permissions: string[];
  expires_at?: string;
  created_at: string;
}

export interface UpdateAPIKeyRequest {
  name?: string;
  queues?: string[];
  rate_limit?: number;
  is_active?: boolean;
}

export const apiKeysAPI = {
  /**
   * GET /api/v1/api-keys
   * List all API keys
   */
  list: (): Promise<APIKey[]> => {
    return apiClient.get<APIKey[]>(API_ENDPOINTS.API_KEYS.LIST);
  },

  /**
   * POST /api/v1/api-keys
   * Create a new API key
   */
  create: (data: CreateAPIKeyRequest): Promise<CreateAPIKeyResponse> => {
    return apiClient.post<CreateAPIKeyResponse>(API_ENDPOINTS.API_KEYS.CREATE, data);
  },

  /**
   * GET /api/v1/api-keys/{id}
   * Get API key details
   */
  get: (id: string): Promise<APIKey> => {
    return apiClient.get<APIKey>(API_ENDPOINTS.API_KEYS.GET(id));
  },

  /**
   * PUT /api/v1/api-keys/{id}
   * Update an API key
   */
  update: (id: string, data: UpdateAPIKeyRequest): Promise<APIKey> => {
    return apiClient.put<APIKey>(API_ENDPOINTS.API_KEYS.UPDATE(id), data);
  },

  /**
   * DELETE /api/v1/api-keys/{id}
   * Revoke an API key
   */
  revoke: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.API_KEYS.REVOKE(id));
  },
};

/**
 * Available API key permissions
 */
export const API_KEY_PERMISSIONS = [
  { value: 'jobs:read', label: 'Jobs: Read', description: 'View jobs and job details' },
  { value: 'jobs:write', label: 'Jobs: Write', description: 'Create and update jobs' },
  { value: 'jobs:delete', label: 'Jobs: Delete', description: 'Cancel and delete jobs' },
  { value: 'queues:read', label: 'Queues: Read', description: 'View queues and queue stats' },
  { value: 'queues:write', label: 'Queues: Write', description: 'Create and update queues' },
  { value: 'queues:admin', label: 'Queues: Admin', description: 'Pause, resume, purge queues' },
  { value: 'workers:read', label: 'Workers: Read', description: 'View worker status' },
  { value: 'workers:write', label: 'Workers: Write', description: 'Register and manage workers' },
  { value: 'schedules:read', label: 'Schedules: Read', description: 'View schedules' },
  {
    value: 'schedules:write',
    label: 'Schedules: Write',
    description: 'Create and manage schedules',
  },
  { value: 'webhooks:read', label: 'Webhooks: Read', description: 'View webhooks' },
  { value: 'webhooks:write', label: 'Webhooks: Write', description: 'Create and manage webhooks' },
] as const;
