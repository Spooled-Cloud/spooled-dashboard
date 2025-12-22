/**
 * Jobs API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type {
  Job,
  CreateJobRequest,
  JobStatistics,
  PaginatedResponse,
  JobStatus,
} from '@/lib/types';

export interface JobListParams {
  page?: number;
  per_page?: number;
  status?: JobStatus | JobStatus[];
  queue?: string;
  job_type?: string;
  from_date?: string;
  to_date?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Backend response types (match Rust API)
interface BackendJobSummary {
  id: string;
  queue_name: string;
  status: string;
  priority: number;
  attempt: number;
  max_retries: number;
  created_at: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

interface BackendJob {
  id: string;
  organization_id: string;
  queue_name: string;
  status: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
  last_error?: string | null;
  created_at: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string | null;
  priority: number;
  tags?: Record<string, unknown> | null;
  timeout_seconds: number;
  parent_job_id?: string | null;
  completion_webhook?: string | null;
  idempotency_key?: string | null;
  updated_at: string;
  workflow_id?: string | null;
}

interface BackendCreateJobResponse {
  id: string;
  created: boolean;
}

function extractJobTypeFromPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';
  const jt = (payload as { job_type?: unknown }).job_type;
  return typeof jt === 'string' ? jt : '';
}

function transformBackendJobSummaryToFrontend(summary: BackendJobSummary): Job {
  return {
    id: summary.id,
    organization_id: '',
    queue: summary.queue_name,
    job_type: '', // not available in backend summary
    payload: {},
    status: summary.status as JobStatus,
    priority: summary.priority,
    attempt: summary.attempt,
    max_retries: summary.max_retries,
    backoff_type: 'exponential',
    timeout_ms: undefined,
    created_at: summary.created_at,
    scheduled_at: summary.scheduled_at ?? undefined,
    started_at: summary.started_at ?? undefined,
    completed_at: summary.completed_at ?? undefined,
    failed_at: undefined,
    next_retry_at: undefined,
    result: undefined,
    error: undefined,
    metadata: undefined,
    workflow_id: undefined,
    parent_job_id: undefined,
  };
}

function transformBackendJobToFrontend(job: BackendJob): Job {
  const jobType = extractJobTypeFromPayload(job.payload);
  return {
    id: job.id,
    organization_id: job.organization_id,
    queue: job.queue_name,
    job_type: jobType || 'job',
    payload: job.payload ?? {},
    status: job.status as JobStatus,
    priority: job.priority,
    attempt: job.retry_count,
    max_retries: job.max_retries,
    backoff_type: 'exponential',
    timeout_ms: (job.timeout_seconds ?? 300) * 1000,
    created_at: job.created_at,
    scheduled_at: job.scheduled_at ?? undefined,
    started_at: job.started_at ?? undefined,
    completed_at: job.completed_at ?? undefined,
    failed_at: undefined,
    next_retry_at: undefined,
    result: (job.result as Record<string, unknown>) ?? undefined,
    error: job.last_error ? { type: 'Error', message: job.last_error } : undefined,
    metadata: (job.tags as Record<string, string>) ?? undefined,
    workflow_id: job.workflow_id ?? undefined,
    parent_job_id: job.parent_job_id ?? undefined,
  };
}

export interface BulkJobItem {
  payload: Record<string, unknown>;
  priority?: number;
  idempotency_key?: string;
  scheduled_at?: string;
}

export interface BulkEnqueueRequest {
  queue_name: string;
  jobs: BulkJobItem[];
  default_priority?: number;
  default_max_retries?: number;
  default_timeout_seconds?: number;
}

export interface BulkEnqueueResponse {
  succeeded: Array<{ index: number; job_id: string; created: boolean }>;
  failed: Array<{ index: number; error: string }>;
  total: number;
  success_count: number;
  failure_count: number;
}

export interface BoostPriorityResponse {
  job_id: string;
  old_priority: number;
  new_priority: number;
}

export interface BatchJobStatus {
  id: string;
  status: JobStatus;
  queue_name: string;
  attempt: number;
  max_retries: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface DependencyInfo {
  job_id: string;
  queue_name: string;
  status: string;
}

export interface JobDependencies {
  job_id: string;
  dependencies: DependencyInfo[];
  dependents: DependencyInfo[];
  dependencies_met: boolean;
}

export interface RetryDlqRequest {
  job_ids?: string[];
  queue_name?: string;
  limit?: number;
}

export interface RetryDlqResponse {
  retried_count: number;
  retried_jobs: string[];
}

export interface PurgeDlqRequest {
  queue_name?: string;
  older_than?: string;
  confirm: boolean;
}

export interface PurgeDlqResponse {
  purged_count: number;
}

export const jobsAPI = {
  /**
   * GET /api/v1/jobs
   * List jobs with filtering and pagination
   */
  list: async (params?: JobListParams): Promise<PaginatedResponse<Job>> => {
    const page = params?.page ?? 1;
    const perPage = params?.per_page ?? 25;
    const offset = (page - 1) * perPage;

    const queue_name = params?.queue || undefined;

    // Backend supports only a single status filter.
    // If an array is provided (e.g. failed+deadletter), fetch and merge for page=1 use-cases.
    const statusParam = params?.status;
    const statuses = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : [];

    const limit = perPage + 1; // fetch one extra to detect "has next page"

    let summaries: BackendJobSummary[] = [];

    if (statuses.length <= 1) {
      summaries = await apiClient.get<BackendJobSummary[]>(API_ENDPOINTS.JOBS.LIST, {
        queue_name,
        status: statuses[0],
        limit,
        offset,
      } as Record<string, string | number | boolean | undefined>);
    } else if (page === 1 && offset === 0) {
      // Merge results for dashboard widgets / first page. Not perfect pagination, but avoids a broken UI.
      const results = await Promise.all(
        statuses.map((status) =>
          apiClient.get<BackendJobSummary[]>(API_ENDPOINTS.JOBS.LIST, {
            queue_name,
            status,
            limit,
            offset: 0,
          } as Record<string, string | number | boolean | undefined>)
        )
      );
      summaries = results.flat();
      summaries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      // de-dupe by id (in case of unexpected overlap)
      const seen = new Set<string>();
      summaries = summaries.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));
      summaries = summaries.slice(0, limit);
    } else {
      // Fallback: use the first status for pagination
      summaries = await apiClient.get<BackendJobSummary[]>(API_ENDPOINTS.JOBS.LIST, {
        queue_name,
        status: statuses[0],
        limit,
        offset,
      } as Record<string, string | number | boolean | undefined>);
    }

    const hasMore = summaries.length > perPage;
    const pageItems = summaries.slice(0, perPage).map(transformBackendJobSummaryToFrontend);

    return {
      data: pageItems,
      page,
      per_page: perPage,
      total: offset + pageItems.length + (hasMore ? 1 : 0),
      total_pages: hasMore ? page + 1 : page,
    };
  },

  /**
   * POST /api/v1/jobs
   * Create a new job
   */
  create: (data: CreateJobRequest): Promise<BackendCreateJobResponse> => {
    // Backend does not have a top-level `job_type` field; persist it inside payload for visibility.
    const payload =
      data.job_type && typeof (data.payload as { job_type?: unknown })?.job_type !== 'string'
        ? { ...(data.payload || {}), job_type: data.job_type }
        : data.payload || {};

    return apiClient.post<BackendCreateJobResponse>(API_ENDPOINTS.JOBS.CREATE, {
      queue_name: data.queue,
      payload,
      priority: data.priority,
      max_retries: data.max_retries,
      timeout_seconds: data.timeout_ms ? Math.floor(data.timeout_ms / 1000) : undefined,
      scheduled_at: data.scheduled_at,
      tags: data.metadata,
      idempotency_key: data.idempotency_key,
      parent_job_id: data.parent_job_id,
    });
  },

  /**
   * GET /api/v1/jobs/{id}
   * Get job details by ID
   */
  get: async (id: string): Promise<Job> => {
    const response = await apiClient.get<BackendJob>(API_ENDPOINTS.JOBS.GET(id));
    return transformBackendJobToFrontend(response);
  },

  /**
   * DELETE /api/v1/jobs/{id}
   * Cancel or delete a job
   */
  delete: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.JOBS.DELETE(id));
  },

  /**
   * POST /api/v1/jobs/{id}/retry
   * Retry a failed job
   */
  retry: async (id: string): Promise<Job> => {
    const response = await apiClient.post<BackendJob>(API_ENDPOINTS.JOBS.RETRY(id));
    return transformBackendJobToFrontend(response);
  },

  /**
   * DELETE /api/v1/jobs/{id}
   * Cancel a pending or scheduled job
   * Note: Uses same endpoint as delete - backend only has DELETE /jobs/{id} for cancellation
   */
  cancel: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.JOBS.DELETE(id));
  },

  /**
   * GET /api/v1/jobs/stats
   * Get job statistics
   */
  getStatistics: (): Promise<JobStatistics> => {
    return apiClient.get<JobStatistics>(API_ENDPOINTS.JOBS.STATS);
  },

  /**
   * GET /api/v1/jobs/status?ids=...
   * Batch job status lookup (up to 100 IDs)
   */
  batchStatus: async (ids: string[]): Promise<BatchJobStatus[]> => {
    if (ids.length === 0) return [];
    if (ids.length > 100) {
      throw new Error('Maximum 100 job IDs per request');
    }
    return apiClient.get<BatchJobStatus[]>(API_ENDPOINTS.JOBS.STATUS, {
      ids: ids.join(','),
    } as Record<string, string>);
  },

  /**
   * GET /api/v1/jobs/{id}/dependencies
   * Get job dependencies
   */
  getDependencies: (id: string): Promise<JobDependencies> => {
    return apiClient.get<JobDependencies>(API_ENDPOINTS.JOBS.DEPENDENCIES(id));
  },

  /**
   * POST /api/v1/jobs/bulk
   * Bulk enqueue multiple jobs
   */
  bulkEnqueue: (data: BulkEnqueueRequest): Promise<BulkEnqueueResponse> => {
    return apiClient.post<BulkEnqueueResponse>(API_ENDPOINTS.JOBS.BULK, data);
  },

  /**
   * PUT /api/v1/jobs/{id}/priority
   * Boost job priority
   */
  boostPriority: (id: string, priority: number): Promise<BoostPriorityResponse> => {
    return apiClient.put<BoostPriorityResponse>(API_ENDPOINTS.JOBS.PRIORITY(id), { priority });
  },

  /**
   * GET /api/v1/jobs/dlq
   * List jobs in dead-letter queue
   */
  listDeadLetter: (params?: {
    queue_name?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> => {
    return apiClient
      .get<BackendJob[]>(API_ENDPOINTS.JOBS.DLQ, params as Record<string, string | number>)
      .then((jobs) => jobs.map(transformBackendJobToFrontend));
  },

  /**
   * POST /api/v1/jobs/dlq/retry
   * Retry jobs from dead-letter queue
   */
  retryDeadLetter: (data: RetryDlqRequest): Promise<RetryDlqResponse> => {
    return apiClient.post<RetryDlqResponse>(API_ENDPOINTS.JOBS.DLQ_RETRY, data);
  },

  /**
   * POST /api/v1/jobs/dlq/purge
   * Purge jobs from dead-letter queue
   */
  purgeDeadLetter: (data: PurgeDlqRequest): Promise<PurgeDlqResponse> => {
    return apiClient.post<PurgeDlqResponse>(API_ENDPOINTS.JOBS.DLQ_PURGE, data);
  },
};
