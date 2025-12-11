/**
 * Queues API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Queue, QueueStats, CreateQueueRequest } from '@/lib/types';

export interface UpdateQueueRequest {
  description?: string;
  concurrency?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  backoff_multiplier?: number;
  max_retry_delay_ms?: number;
  job_timeout_ms?: number;
}

export const queuesAPI = {
  /**
   * GET /api/v1/queues
   * List all queues
   */
  list: (): Promise<Queue[]> => {
    return apiClient.get<Queue[]>(API_ENDPOINTS.QUEUES.LIST);
  },

  /**
   * POST /api/v1/queues
   * Create a new queue
   */
  create: (data: CreateQueueRequest): Promise<Queue> => {
    return apiClient.post<Queue>(API_ENDPOINTS.QUEUES.CREATE, data);
  },

  /**
   * GET /api/v1/queues/{name}
   * Get queue details by name
   */
  get: (name: string): Promise<Queue> => {
    return apiClient.get<Queue>(API_ENDPOINTS.QUEUES.GET(name));
  },

  /**
   * PUT /api/v1/queues/{name}
   * Update queue configuration
   */
  update: (name: string, data: UpdateQueueRequest): Promise<Queue> => {
    return apiClient.put<Queue>(API_ENDPOINTS.QUEUES.UPDATE(name), data);
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
  getStats: (name: string): Promise<QueueStats> => {
    return apiClient.get<QueueStats>(API_ENDPOINTS.QUEUES.STATS(name));
  },

  /**
   * POST /api/v1/queues/{name}/pause
   * Pause job processing for a queue
   */
  pause: (name: string): Promise<Queue> => {
    return apiClient.post<Queue>(API_ENDPOINTS.QUEUES.PAUSE(name));
  },

  /**
   * POST /api/v1/queues/{name}/resume
   * Resume job processing for a queue
   */
  resume: (name: string): Promise<Queue> => {
    return apiClient.post<Queue>(API_ENDPOINTS.QUEUES.RESUME(name));
  },

  /**
   * POST /api/v1/queues/{name}/purge
   * Delete all jobs in a queue
   */
  purge: (name: string): Promise<{ deleted: number }> => {
    return apiClient.post<{ deleted: number }>(API_ENDPOINTS.QUEUES.PURGE(name));
  },
};
