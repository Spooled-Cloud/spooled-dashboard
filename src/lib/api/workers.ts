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
  /** Backend 0.1.122+ */
  jobs_processed?: number;
  /** Backend 0.1.122+ */
  jobs_failed?: number;
}

/** GET /api/v1/workers/{id} — `WorkerResponse`, not the DB `Worker` row. */
interface BackendWorker {
  id: string;
  organization_id: string;
  queue_name: string;
  queue_names?: string[];
  hostname: string;
  worker_type?: string;
  max_concurrency: number;
  current_jobs: number;
  status: string;
  last_heartbeat: string;
  metadata?: Record<string, unknown>;
  version?: string;
  registered_at: string;
  updated_at: string;
  /** Backend 0.1.122+ */
  jobs_processed?: number;
  /** Backend 0.1.122+ */
  jobs_failed?: number;
}

/** A counter the backend sent, or `undefined` (older backend: nothing to show). */
function counterFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Backend workers are healthy/degraded/offline/draining. Healthy with no
 * current jobs is idle. Degraded stays degraded: the worker is heartbeating
 * but over capacity, and home already counts it as unhealthy. Mapping it to
 * active made the workers page call that same worker Active.
 */
function mapWorkerStatus(status: string, currentJobs: number): Worker['status'] {
  if (status === 'offline') return 'offline';
  if (status === 'draining') return 'draining';
  if (status === 'idle') return 'idle';
  if (status === 'degraded') return 'degraded';
  if (status === 'healthy' || status === 'active') {
    return currentJobs > 0 ? 'active' : 'idle';
  }
  return 'offline';
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
    status: mapWorkerStatus(backend.status, backend.current_jobs),
    last_heartbeat: backend.last_heartbeat,
    // The list summary carries no registration time, so started_at stays undefined rather
    // than borrowing another timestamp. The counters exist from backend 0.1.122 on.
    jobs_processed: counterFrom(backend.jobs_processed),
    jobs_failed: counterFrom(backend.jobs_failed),
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
    concurrency: backend.max_concurrency ?? 0,
    current_jobs: backend.current_jobs ?? 0,
    status: mapWorkerStatus(backend.status, backend.current_jobs ?? 0),
    last_heartbeat: backend.last_heartbeat,
    started_at: backend.registered_at,
    metadata: backend.metadata as Record<string, string>,
    jobs_processed: counterFrom(backend.jobs_processed),
    jobs_failed: counterFrom(backend.jobs_failed),
  };
}

/**
 * Share of finished attempts that succeeded: processed / (processed + failed), in percent.
 * `undefined` when the backend sends no counters (before 0.1.122) or the worker has not
 * finished anything yet, so the UI shows a dash instead of a made-up 0% or 100%.
 */
export function workerSuccessRate(
  worker: Pick<Worker, 'jobs_processed' | 'jobs_failed'>
): number | undefined {
  const { jobs_processed: processed, jobs_failed: failed } = worker;
  if (processed === undefined || failed === undefined) return undefined;
  const total = processed + failed;
  return total > 0 ? (processed / total) * 100 : undefined;
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
   * POST /api/v1/workers/{id}/deregister
   * Deregister a worker
   */
  deregister: (id: string): Promise<void> => {
    return apiClient.post<void>(API_ENDPOINTS.WORKERS.DEREGISTER(id));
  },
};
