/**
 * Queues API
 *
 * Handles API calls for queue operations with response transformation
 * from backend format to frontend expected format.
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Queue, QueueStats, CreateQueueRequest } from '@/lib/types';

// Backend response types (match actual API response)
interface BackendQueueConfig {
  id: string;
  organization_id: string;
  queue_name: string;
  max_retries: number;
  default_timeout: number;
  rate_limit?: number;
  enabled: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BackendQueueConfigSummary {
  queue_name: string;
  max_retries: number;
  default_timeout: number;
  rate_limit?: number;
  enabled: boolean;
}

interface BackendQueueStats {
  queue_name: string;
  pending_jobs: number;
  processing_jobs: number;
  completed_jobs_24h: number;
  failed_jobs_24h: number;
  avg_processing_time_ms?: number;
  max_job_age_seconds?: number;
  active_workers: number;
}

interface BackendPauseResponse {
  queue_name: string;
  paused: boolean;
  paused_at: string;
  reason?: string;
}

interface BackendResumeResponse {
  queue_name: string;
  resumed: boolean;
  paused_duration_secs: number;
}

/**
 * Transform backend QueueConfig to frontend Queue type
 */
function transformQueueConfig(backend: BackendQueueConfig): Queue {
  // Check if queue is paused from settings
  const isPaused =
    !backend.enabled ||
    Boolean(backend.settings && (backend.settings as { paused?: boolean }).paused);

  return {
    name: backend.queue_name,
    organization_id: backend.organization_id,
    description: (backend.settings as { description?: string })?.description,
    concurrency: (backend.settings as { concurrency?: number })?.concurrency ?? 10,
    max_retries: backend.max_retries,
    retry_delay_ms: (backend.settings as { retry_delay_ms?: number })?.retry_delay_ms ?? 1000,
    backoff_multiplier:
      (backend.settings as { backoff_multiplier?: number })?.backoff_multiplier ?? 2,
    max_retry_delay_ms:
      (backend.settings as { max_retry_delay_ms?: number })?.max_retry_delay_ms ?? 60000,
    job_timeout_ms: backend.default_timeout * 1000, // Convert seconds to ms
    paused: isPaused,
    created_at: backend.created_at,
    updated_at: backend.updated_at,
  };
}

/**
 * Transform backend QueueConfigSummary to frontend Queue type (partial)
 */
function transformQueueSummary(backend: BackendQueueConfigSummary): Queue {
  return {
    name: backend.queue_name,
    organization_id: '',
    concurrency: 10,
    max_retries: backend.max_retries,
    retry_delay_ms: 1000,
    backoff_multiplier: 2,
    max_retry_delay_ms: 60000,
    job_timeout_ms: backend.default_timeout * 1000,
    paused: !backend.enabled,
    created_at: '',
    updated_at: '',
  };
}

/**
 * Transform backend QueueStats to frontend QueueStats type
 */
function transformQueueStats(backend: BackendQueueStats): QueueStats {
  return {
    name: backend.queue_name,
    pending: backend.pending_jobs,
    processing: backend.processing_jobs,
    completed: backend.completed_jobs_24h,
    failed: backend.failed_jobs_24h,
    deadletter: 0, // Not provided by backend, would need separate query
    active_workers: backend.active_workers,
    jobs_per_second:
      backend.avg_processing_time_ms && backend.avg_processing_time_ms > 0
        ? 1000 / backend.avg_processing_time_ms
        : 0,
    avg_processing_time_ms: backend.avg_processing_time_ms ?? 0,
  };
}

export interface UpdateQueueRequest {
  description?: string;
  concurrency?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  backoff_multiplier?: number;
  max_retry_delay_ms?: number;
  job_timeout_ms?: number;
}

/**
 * Transform frontend UpdateQueueRequest to backend format
 */
function transformUpdateRequest(data: UpdateQueueRequest): {
  max_retries?: number;
  default_timeout?: number;
  settings?: Record<string, unknown>;
} {
  const settings: Record<string, unknown> = {};

  if (data.description !== undefined) settings.description = data.description;
  if (data.concurrency !== undefined) settings.concurrency = data.concurrency;
  if (data.retry_delay_ms !== undefined) settings.retry_delay_ms = data.retry_delay_ms;
  if (data.backoff_multiplier !== undefined) settings.backoff_multiplier = data.backoff_multiplier;
  if (data.max_retry_delay_ms !== undefined) settings.max_retry_delay_ms = data.max_retry_delay_ms;

  return {
    max_retries: data.max_retries,
    default_timeout: data.job_timeout_ms ? Math.floor(data.job_timeout_ms / 1000) : undefined,
    settings: Object.keys(settings).length > 0 ? settings : undefined,
  };
}

export const queuesAPI = {
  /**
   * GET /api/v1/queues
   * List all queues
   */
  list: async (): Promise<Queue[]> => {
    const response = await apiClient.get<BackendQueueConfigSummary[]>(API_ENDPOINTS.QUEUES.LIST);
    return response.map(transformQueueSummary);
  },

  /**
   * POST /api/v1/queues
   * Create a new queue
   */
  create: async (data: CreateQueueRequest): Promise<Queue> => {
    const backendData = {
      queue_name: data.name,
      max_retries: data.max_retries ?? 3,
      default_timeout: data.job_timeout_ms ? Math.floor(data.job_timeout_ms / 1000) : 300,
      settings: {
        description: data.description,
        concurrency: data.concurrency ?? 10,
        retry_delay_ms: data.retry_delay_ms ?? 1000,
        backoff_multiplier: data.backoff_multiplier ?? 2,
        max_retry_delay_ms: data.max_retry_delay_ms ?? 60000,
      },
    };
    const response = await apiClient.post<BackendQueueConfig>(
      API_ENDPOINTS.QUEUES.CREATE,
      backendData
    );
    return transformQueueConfig(response);
  },

  /**
   * GET /api/v1/queues/{name}
   * Get queue details by name
   */
  get: async (name: string): Promise<Queue> => {
    const response = await apiClient.get<BackendQueueConfig>(API_ENDPOINTS.QUEUES.GET(name));
    return transformQueueConfig(response);
  },

  /**
   * PUT /api/v1/queues/{name}
   * Update queue configuration
   */
  update: async (name: string, data: UpdateQueueRequest): Promise<Queue> => {
    const backendData = transformUpdateRequest(data);
    const response = await apiClient.put<BackendQueueConfig>(
      API_ENDPOINTS.QUEUES.UPDATE(name),
      backendData
    );
    return transformQueueConfig(response);
  },

  /**
   * DELETE /api/v1/queues/{name}
   * Delete a queue (must be empty)
   */
  delete: (name: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.QUEUES.DELETE(name));
  },

  /**
   * GET /api/v1/queues/{name}/stats
   * Get queue statistics
   */
  getStats: async (name: string): Promise<QueueStats> => {
    const response = await apiClient.get<BackendQueueStats>(API_ENDPOINTS.QUEUES.STATS(name));
    return transformQueueStats(response);
  },

  /**
   * POST /api/v1/queues/{name}/pause
   * Pause job processing for a queue
   */
  pause: async (name: string, reason?: string): Promise<Queue> => {
    const response = await apiClient.post<BackendPauseResponse>(
      API_ENDPOINTS.QUEUES.PAUSE(name),
      { reason } // Backend expects PauseQueueRequest with optional reason
    );
    // Return a partial Queue object representing the paused state
    return {
      name: response.queue_name,
      organization_id: '',
      concurrency: 10,
      max_retries: 3,
      retry_delay_ms: 1000,
      backoff_multiplier: 2,
      max_retry_delay_ms: 60000,
      job_timeout_ms: 300000,
      paused: response.paused,
      created_at: '',
      updated_at: '',
    };
  },

  /**
   * POST /api/v1/queues/{name}/resume
   * Resume job processing for a queue
   */
  resume: async (name: string): Promise<Queue> => {
    const response = await apiClient.post<BackendResumeResponse>(API_ENDPOINTS.QUEUES.RESUME(name));
    // Return a partial Queue object representing the resumed state
    return {
      name: response.queue_name,
      organization_id: '',
      concurrency: 10,
      max_retries: 3,
      retry_delay_ms: 1000,
      backoff_multiplier: 2,
      max_retry_delay_ms: 60000,
      job_timeout_ms: 300000,
      paused: !response.resumed,
      created_at: '',
      updated_at: '',
    };
  },

  /**
   * POST /api/v1/queues/{name}/purge
   * Delete all jobs in a queue
   */
  purge: (name: string): Promise<{ deleted: number }> => {
    return apiClient.post<{ deleted: number }>(API_ENDPOINTS.QUEUES.PURGE(name));
  },
};
