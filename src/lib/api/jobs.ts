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
  /** One status or several. Several go out as ONE comma-joined `status` value. */
  status?: JobStatus | JobStatus[];
  queue?: string;
  /** Exact match on `payload.job_type` (server-side). */
  job_type?: string;
  /**
   * Free-text search, sent as `q`. The backend matches, case-insensitively, a job id PREFIX,
   * or a substring of the queue name or of `payload.job_type`. `%`, `_` and `\` are literal.
   */
  search?: string;
  /** One tag: an element of a tags array or a key of a tags object. */
  tag?: string;
  /** RFC 3339 instant; only jobs created at or after it. */
  created_after?: string;
  /** RFC 3339 instant; only jobs created before it. */
  created_before?: string;
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

/**
 * One page of the jobs list. `GET /jobs` returns a bare array with no total, so `total` and
 * `total_pages` are floors derived from the rows read unless `totalExact` says otherwise.
 */
export interface JobListPage extends PaginatedResponse<Job> {
  /**
   * True only when `total` is the exact number of jobs behind the view (`withExactTotal`, from
   * `GET /jobs/stats`). When false, `total` and `total_pages` are guesses: never print them as
   * "of N results" / "of M pages", page by `hasMore` instead.
   */
  totalExact: boolean;
  /** Whether another page follows (`X-Has-More`, or the extra probe row); false past the page cap. */
  hasMore: boolean;
  /**
   * The server ignored a search, type or date filter (backend before 0.1.122 answers with an
   * unfiltered list and no `X-Has-More`). `data` is empty on purpose: those rows are not results.
   */
  filtersUnsupported: boolean;
}

/** Shown instead of rows when the server did not apply a search, type or date filter. */
export const JOBS_FILTER_UNSUPPORTED_MESSAGE =
  'This server version cannot filter by search, type or date yet';

/** `MAX_JOBS_PER_PAGE` on the backend — a larger `limit` is clamped, not honoured. */
const BACKEND_MAX_PAGE_SIZE = 100;

/**
 * True while list responses carry a readable `X-Has-More` header. The backend (0.1.122) sends
 * it, but a browser only reads it cross-origin once the API's CORS layer exposes it. Until a
 * response proves it, the list asks for one row more than the page and counts the extra row.
 */
let hasMoreHeaderReadable = false;

/** Forget what earlier list responses showed about `X-Has-More` (tests). */
export function resetHasMoreProbe(): void {
  hasMoreHeaderReadable = false;
}

/** `X-Has-More: true|false` as a boolean, `undefined` when the header is absent or not exposed. */
export function parseHasMore(headers: Headers): boolean | undefined {
  const value = headers.get('x-has-more');
  if (value === null) return undefined;
  return value.trim().toLowerCase() === 'true';
}

/**
 * Deepest page the jobs list will request. The backend pages with OFFSET, so a jump to
 * page 400000 of a 10M-job org costs an ever larger scan; narrow with filters instead.
 */
export const JOBS_LIST_MAX_PAGE = 200;

/**
 * Apply the exact total from `GET /jobs/stats` (see `jobsAPI.getListTotal`) to a page
 * whose own total is derived from the rows it fetched. Never reports fewer jobs than the
 * page already proves exist, and never offers pages beyond `JOBS_LIST_MAX_PAGE`. This is the
 * only place a page becomes `totalExact`; without a usable figure the page is returned as is.
 */
export function withExactTotal(page: JobListPage, exactTotal: number | undefined): JobListPage {
  if (typeof exactTotal !== 'number' || !Number.isFinite(exactTotal)) return page;
  const total = Math.max(exactTotal, page.total);
  const totalPages = Math.max(page.total_pages, Math.ceil(total / page.per_page), 1);
  return {
    ...page,
    total,
    total_pages: Math.min(totalPages, JOBS_LIST_MAX_PAGE),
    totalExact: true,
  };
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

interface BackendJobHistoryEvent {
  id: string;
  job_id: string;
  event_type: string;
  worker_id?: string | null;
  details?: unknown;
  created_at: string;
}

/** One row of `GET /jobs/{id}/history` (`job_history`). */
export interface JobHistoryEvent {
  id: string;
  job_id: string;
  /** `created`, `processing`, `completed`, `retry_scheduled`, `deadlettered`, ... */
  event_type: string;
  worker_id: string | null;
  /** Event-specific object (error, retry_count, next_run, lease_id, organization_id, ...). */
  details: Record<string, unknown>;
  created_at: string;
}

export interface JobHistoryPage {
  events: JobHistoryEvent[];
  /** `X-Has-More`; `undefined` when the browser cannot read it. */
  hasMore: boolean | undefined;
}

function transformJobHistoryEvent(event: BackendJobHistoryEvent): JobHistoryEvent {
  const details =
    event.details && typeof event.details === 'object' && !Array.isArray(event.details)
      ? (event.details as Record<string, unknown>)
      : {};
  return {
    id: event.id,
    job_id: event.job_id,
    event_type: event.event_type,
    worker_id: typeof event.worker_id === 'string' && event.worker_id ? event.worker_id : null,
    details,
    created_at: event.created_at,
  };
}

/** Backend cap on one DLQ purge request (`MAX_PURGE_LIMIT`). */
export const DLQ_PURGE_MAX_LIMIT = 10000;
/** Backend cap on one DLQ retry request (`MAX_DLQ_RETRY_LIMIT`). */
export const DLQ_RETRY_MAX_LIMIT = 100;

export interface RetryDlqRequest {
  job_ids?: string[];
  queue_name?: string;
  /** Maximum jobs to retry (backend: 1..100, default 100). */
  limit?: number;
}

export interface RetryDlqResponse {
  retried_count: number;
  retried_jobs: string[];
}

export interface PurgeDlqRequest {
  queue_name?: string;
  older_than?: string;
  /** Maximum jobs to purge (backend: 1..10000, default 10000). */
  limit?: number;
  confirm: boolean;
}

export interface PurgeDlqResponse {
  purged_count: number;
}

export const jobsAPI = {
  /**
   * GET /api/v1/jobs
   * List jobs with server-side filtering (status list, q, job_type, tag, created window) and
   * offset paging. The body is a bare array with no total; whether another page follows comes
   * from `X-Has-More` when the browser can read it, else from one extra probe row. The exact
   * count comes from `getListTotal`, which callers fetch as a separate, slowly refreshed query.
   */
  list: async (params?: JobListParams): Promise<JobListPage> => {
    const perPage = params?.per_page ?? 25;
    // A page jump is capped (see JOBS_LIST_MAX_PAGE): never an OFFSET scan past that depth.
    const page = Math.min(Math.max(1, Math.floor(params?.page ?? 1)), JOBS_LIST_MAX_PAGE);
    const offset = (page - 1) * perPage;

    const statusParam = params?.status;
    const statuses = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : [];

    // Ask for exactly one page when the has-more header is readable, else for one row more.
    const probe = !hasMoreHeaderReadable && perPage < BACKEND_MAX_PAGE_SIZE;
    const limit = probe ? perPage + 1 : perPage;

    const q = params?.search?.trim() || undefined;
    const jobType = params?.job_type?.trim() || undefined;
    const createdAfter = params?.created_after || undefined;
    const createdBefore = params?.created_before || undefined;

    const { data: rows, headers } = await apiClient.getWithHeaders<BackendJobSummary[]>(
      API_ENDPOINTS.JOBS.LIST,
      {
        queue_name: params?.queue || undefined,
        status: statuses.length > 0 ? statuses.join(',') : undefined,
        q,
        job_type: jobType,
        tag: params?.tag?.trim() || undefined,
        created_after: createdAfter,
        created_before: createdBefore,
        limit,
        offset,
      }
    );

    const headerHasMore = parseHasMore(headers);
    hasMoreHeaderReadable = headerHasMore !== undefined;

    // Backend 0.1.121 ignores q, job_type and the created window and answers with the
    // unfiltered list; only a 0.1.122+ response carries X-Has-More. Those rows are not the
    // results of the search, so none are returned (queue, status and tag work on both).
    if ((q || jobType || createdAfter || createdBefore) && headerHasMore === undefined) {
      return {
        data: [],
        page,
        per_page: perPage,
        total: 0,
        total_pages: 1,
        totalExact: false,
        hasMore: false,
        filtersUnsupported: true,
      };
    }

    const hasMore = probe
      ? rows.length > perPage
      : // A full page may be followed by another when the answer cannot be read.
        (headerHasMore ?? rows.length >= perPage);

    const pageItems = rows.slice(0, perPage).map(transformBackendJobSummaryToFrontend);
    const seen = offset + pageItems.length;

    return {
      data: pageItems,
      page,
      per_page: perPage,
      total: seen + (hasMore ? 1 : 0),
      total_pages: Math.min(hasMore ? page + 1 : page, JOBS_LIST_MAX_PAGE),
      // The figures above are floors from the rows read; `withExactTotal` makes them exact.
      totalExact: false,
      hasMore: hasMore && page < JOBS_LIST_MAX_PAGE,
      filtersUnsupported: false,
    };
  },

  /**
   * GET /api/v1/jobs/stats — the exact number of jobs behind a list view.
   * Defined for an unfiltered view or a single status (optionally within one queue);
   * `undefined` for a multi-status filter, which the backend cannot count in one call.
   * Kept apart from `list` so callers can cache it far longer than the page itself.
   */
  getListTotal: async (params?: {
    queue?: string;
    status?: JobStatus | JobStatus[];
  }): Promise<number | undefined> => {
    const status = params?.status;
    const statuses = Array.isArray(status) ? status : status ? [status] : [];
    if (statuses.length > 1) return undefined;
    const stats = await jobsAPI.getStatistics(params?.queue || undefined);
    const value = statuses[0] ? stats[statuses[0]] : stats.total;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
   * POST /api/v1/jobs/{id}/retry
   * Retry a failed job
   */
  retry: async (id: string): Promise<Job> => {
    const response = await apiClient.post<BackendJob>(API_ENDPOINTS.JOBS.RETRY(id));
    return transformBackendJobToFrontend(response);
  },

  /**
   * DELETE /api/v1/jobs/{id}
   * Cancel a pending or scheduled job (409 for any other status).
   * The backend has no hard-delete route: DELETE /jobs/{id} only cancels.
   */
  cancel: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.JOBS.DELETE(id));
  },

  /**
   * GET /api/v1/jobs/stats
   * Get job statistics
   */
  getStatistics: (queue?: string): Promise<JobStatistics> => {
    return apiClient.get<JobStatistics>(
      API_ENDPOINTS.JOBS.STATS,
      queue ? { queue_name: queue } : undefined
    );
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
   * GET /api/v1/jobs/{id}/history
   * Recorded lifecycle events of a job, oldest first by default. Only code paths that write
   * `job_history` rows appear (REST claim, complete and fail, the scheduler's dead-letter
   * sweeps), so a job processed over gRPC has fewer events than it went through.
   * A 404 means the job is unknown or the backend predates the route (before 0.1.122).
   */
  getHistory: async (
    id: string,
    params?: { order_dir?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<JobHistoryPage> => {
    const { data, headers } = await apiClient.getWithHeaders<BackendJobHistoryEvent[]>(
      API_ENDPOINTS.JOBS.HISTORY(id),
      { order_dir: params?.order_dir, limit: params?.limit, offset: params?.offset }
    );
    return {
      events: (Array.isArray(data) ? data : []).map(transformJobHistoryEvent),
      hasMore: parseHasMore(headers),
    };
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
