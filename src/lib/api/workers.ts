/**
 * Workers API
 *
 * Handles API calls for worker operations with response transformation
 * from backend format to frontend expected format.
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Worker } from '@/lib/types';

// Backend response types (match actual API response)
interface BackendWorkerSummary {
  id: string;
  queue_name: string;
  hostname: string;
  status: string;
  current_jobs: number;
  max_concurrency: number;
  last_heartbeat: string;
}

interface BackendWorker {
  id: string;
  organization_id: string;
  queue_name: string;
  queue_names?: string[];
  hostname: string;
  worker_type?: string;
  max_concurrent_jobs: number;
  current_job_count: number;
  status: string;
  last_heartbeat: string;
  metadata?: Record<string, unknown>;
  version?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Transform backend WorkerSummary to frontend Worker type
 */
function transformWorkerSummary(backend: BackendWorkerSummary): Worker {
  return {
    id: backend.id,
    organization_id: '',
    hostname: backend.hostname,
    queues: backend.queue_name ? [backend.queue_name] : [],
    concurrency: backend.max_concurrency,
    current_jobs: backend.current_jobs,
    status: (backend.status === 'healthy' ? 'active' : backend.status) as Worker['status'],
    last_heartbeat: backend.last_heartbeat,
    started_at: backend.last_heartbeat, // Not provided in summary, use last_heartbeat
    jobs_processed: 0, // Not provided in summary
    jobs_failed: 0, // Not provided in summary
  };
}

/**
 * Transform backend Worker to frontend Worker type
 */
function transformWorker(backend: BackendWorker): Worker {
  return {
    id: backend.id,
    organization_id: backend.organization_id,
    hostname: backend.hostname,
    queues: backend.queue_names?.length ? backend.queue_names : [backend.queue_name],
    concurrency: backend.max_concurrent_jobs,
    current_jobs: backend.current_job_count,
    status: (backend.status === 'healthy' ? 'active' : backend.status) as Worker['status'],
    last_heartbeat: backend.last_heartbeat,
    started_at: backend.created_at,
    jobs_processed: 0, // Would need separate stats query
    jobs_failed: 0, // Would need separate stats query
    metadata: backend.metadata as Record<string, string>,
  };
}

export const workersAPI = {
  /**
   * GET /api/v1/workers
   * List all registered workers
   */
  list: async (): Promise<Worker[]> => {
    const response = await apiClient.get<BackendWorkerSummary[]>(API_ENDPOINTS.WORKERS.LIST);
    return response.map(transformWorkerSummary);
  },

  /**
   * GET /api/v1/workers/{id}
   * Get worker details by ID
   */
  get: async (id: string): Promise<Worker> => {
    const response = await apiClient.get<BackendWorker>(API_ENDPOINTS.WORKERS.GET(id));
    return transformWorker(response);
  },

  /**
   * DELETE /api/v1/workers/{id}
   * Deregister a worker
   */
  deregister: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.WORKERS.DEREGISTER(id));
  },
};
