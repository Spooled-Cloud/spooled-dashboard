/**
 * Jobs API
 */

import { APIError, apiClient } from './client';
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
  /** Client-side: job id substring or job_type. Backend list has no search. */
  search?: string;
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
  job_type?: string;
  last_error?: string | null;
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

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `MAX_JOBS_PER_PAGE` on the backend — a larger `limit` is clamped, not honoured. */
const SEARCH_CHUNK = 100;
/** Upper bound on rows a client-side search will pull before giving up. */
const SEARCH_MAX_SCAN = 500;

function jobMatchesListFilters(job: Job, search?: string, jobType?: string): boolean {
  if (jobType && job.job_type !== jobType) return false;
  if (!search) return true;
  const q = search.toLowerCase();
  return job.id.toLowerCase().includes(q) || job.job_type.toLowerCase().includes(q);
}

function failedAtFrom(
  status: string,
  completedAt?: string | null,
  updatedAt?: string | null
): string | undefined {
  if (status !== 'failed' && status !== 'deadletter') return undefined;
  return completedAt ?? updatedAt ?? undefined;
}

function nextRetryAtFrom(
  status: string,
  lastError?: string | null,
  scheduledAt?: string | null
): string | undefined {
  if (status !== 'pending' || !lastError || !scheduledAt) return undefined;
  return scheduledAt;
}

function extractJobTypeFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const jt = (payload as { job_type?: unknown }).job_type;
  return typeof jt === 'string' ? jt : '';
}

/** Persist dashboard `job_type` inside object payloads only. Spreading a string/array turns it into `{0: ...}`. */
function payloadWithJobType(payload: unknown, jobType?: string): unknown {
  const isPlainObject = payload !== null && typeof payload === 'object' && !Array.isArray(payload);
  if (isPlainObject) {
    const existing = (payload as { job_type?: unknown }).job_type;
    if (!jobType || typeof existing === 'string') return payload;
    return { ...(payload as Record<string, unknown>), job_type: jobType };
  }
  if (payload === undefined || payload === null) {
    return jobType ? { job_type: jobType } : {};
  }
  return payload;
}

function transformBackendJobSummaryToFrontend(summary: BackendJobSummary): Job {
  return {
    id: summary.id,
    organization_id: '',
    queue: summary.queue_name,
    job_type: summary.job_type || '',
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
    failed_at: failedAtFrom(summary.status, summary.completed_at),
    next_retry_at: nextRetryAtFrom(summary.status, summary.last_error, summary.scheduled_at),
    result: undefined,
    error: summary.last_error ? { type: 'Error', message: summary.last_error } : undefined,
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
    failed_at: failedAtFrom(job.status, job.completed_at, job.updated_at),
    next_retry_at: nextRetryAtFrom(job.status, job.last_error, job.scheduled_at),
    result: (job.result as Record<string, unknown>) ?? undefined,
    error: job.last_error ? { type: 'Error', message: job.last_error } : undefined,
    metadata: (job.tags as Record<string, string>) ?? undefined,
    workflow_id: job.workflow_id ?? undefined,
    parent_job_id: job.parent_job_id ?? undefined,
  };
}

export interface BulkJobItem {
  payload: unknown;
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

interface BackendBatchJobStatus {
  id: string;
  status: string;
  queue_name: string;
  retry_count: number;
  created_at: string;
  completed_at?: string | null;
}

export interface BatchJobStatus {
  id: string;
  status: JobStatus;
  queue_name: string;
  /** Mapped from backend `retry_count`. Batch status does not send `attempt`. */
  attempt: number;
  created_at: string;
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

    const fetchPage = (
      status: string | undefined,
      pageOffset: number,
      pageLimit: number
    ): Promise<BackendJobSummary[]> =>
      apiClient.get<BackendJobSummary[]>(API_ENDPOINTS.JOBS.LIST, {
        queue_name,
        status,
        limit: pageLimit,
        offset: pageOffset,
      } as Record<string, string | number | boolean | undefined>);

    /** Newest-first merge of per-status lists, de-duped by id. */
    const mergeByRecency = (lists: BackendJobSummary[][], cap: number): BackendJobSummary[] => {
      const merged = lists.flat();
      merged.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const seen = new Set<string>();
      return merged.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true))).slice(0, cap);
    };

    const search = params?.search?.trim();
    const jobType = params?.job_type?.trim();
    const hasSearch = Boolean(search || jobType);

    if (!hasSearch) {
      let summaries: BackendJobSummary[] = [];

      if (statuses.length <= 1) {
        summaries = await fetchPage(statuses[0], offset, limit);
      } else if (page === 1 && offset === 0) {
        // Merge results for dashboard widgets / first page. Not perfect pagination, but avoids a broken UI.
        summaries = mergeByRecency(
          await Promise.all(statuses.map((status) => fetchPage(status, 0, limit))),
          limit
        );
      } else {
        // Fallback: use the first status for pagination
        summaries = await fetchPage(statuses[0], offset, limit);
      }

      const pageItems = summaries.slice(0, perPage).map(transformBackendJobSummaryToFrontend);
      const hasMore = summaries.length > perPage;

      return {
        data: pageItems,
        page,
        per_page: perPage,
        total: offset + pageItems.length + (hasMore ? 1 : 0),
        total_pages: hasMore ? page + 1 : page,
      };
    }

    // `ListJobsQuery` on the backend is queue/status/tag only — there is no search or
    // job_type filter — so the dashboard filters rows itself. Scan a bounded window from
    // the newest job rather than only the requested page: filtering one page of 25 makes
    // a match three pages deep read as "no results".
    const scanned: BackendJobSummary[] = [];
    const scannedIds = new Set<string>();
    for (let scanOffset = 0; scanOffset < SEARCH_MAX_SCAN; scanOffset += SEARCH_CHUNK) {
      const chunkLimit = Math.min(SEARCH_CHUNK, SEARCH_MAX_SCAN - scanOffset);
      const chunk =
        statuses.length <= 1
          ? await fetchPage(statuses[0], scanOffset, chunkLimit)
          : mergeByRecency(
              await Promise.all(
                statuses.map((status) => fetchPage(status, scanOffset, chunkLimit))
              ),
              chunkLimit
            );

      for (const row of chunk) {
        if (!scannedIds.has(row.id)) {
          scannedIds.add(row.id);
          scanned.push(row);
        }
      }

      if (chunk.length < chunkLimit) break; // exhausted the result set
    }

    let matches = scanned
      .map(transformBackendJobSummaryToFrontend)
      .filter((job) => jobMatchesListFilters(job, search, jobType));

    // A job older than the scan window is still reachable when the query is its exact id.
    if (matches.length === 0 && search && JOB_ID_RE.test(search)) {
      try {
        const job = await jobsAPI.get(search);
        if (jobMatchesListFilters(job, search, jobType)) {
          if (!queue_name || job.queue === queue_name) {
            if (statuses.length === 0 || statuses.includes(job.status)) {
              matches = [job];
            }
          }
        }
      } catch (err) {
        if (!(err instanceof APIError && err.isNotFound())) {
          throw err;
        }
      }
    }

    const matchOffset = (page - 1) * perPage;

    return {
      data: matches.slice(matchOffset, matchOffset + perPage),
      page,
      per_page: perPage,
      total: matches.length,
      total_pages: Math.max(1, Math.ceil(matches.length / perPage)),
    };
  },

  /**
   * POST /api/v1/jobs
   * Create a new job
   */
  create: (data: CreateJobRequest): Promise<BackendCreateJobResponse> => {
    // Backend payload is serde_json::Value. job_type is not a column; merge it
    // only when payload is a JSON object so arrays/strings are not spread.
    const payload = payloadWithJobType(data.payload, data.job_type);

    return apiClient.post<BackendCreateJobResponse>(API_ENDPOINTS.JOBS.CREATE, {
      queue_name: data.queue,
      payload,
      priority: data.priority,
      max_retries: data.max_retries,
      timeout_seconds:
        data.timeout_ms != null && data.timeout_ms > 0
          ? Math.max(1, Math.floor(data.timeout_ms / 1000))
          : undefined,
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
    const rows = await apiClient.get<BackendBatchJobStatus[]>(API_ENDPOINTS.JOBS.STATUS, {
      ids: ids.join(','),
    } as Record<string, string>);
    return rows.map((row) => ({
      id: row.id,
      status: row.status as JobStatus,
      queue_name: row.queue_name,
      attempt: row.retry_count,
      created_at: row.created_at,
      completed_at: row.completed_at ?? undefined,
    }));
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
   * GET /api/v1/jobs/dlq — `JobSummary[]`, same as `GET /jobs`.
   */
  listDeadLetter: (params?: {
    queue_name?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> => {
    return apiClient
      .get<BackendJobSummary[]>(API_ENDPOINTS.JOBS.DLQ, params as Record<string, string | number>)
      .then((jobs) => jobs.map(transformBackendJobSummaryToFrontend));
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
