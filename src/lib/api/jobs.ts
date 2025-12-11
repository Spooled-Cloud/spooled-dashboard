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
  list: (params?: JobListParams): Promise<PaginatedResponse<Job>> => {
    return apiClient.get<PaginatedResponse<Job>>(
      API_ENDPOINTS.JOBS.LIST,
      params as Record<string, string | number | boolean>
    );
  },

  /**
   * POST /api/v1/jobs
   * Create a new job
   */
  create: (data: CreateJobRequest): Promise<Job> => {
    return apiClient.post<Job>(API_ENDPOINTS.JOBS.CREATE, data);
  },

  /**
   * GET /api/v1/jobs/{id}
   * Get job details by ID
   */
  get: (id: string): Promise<Job> => {
    return apiClient.get<Job>(API_ENDPOINTS.JOBS.GET(id));
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
  retry: (id: string): Promise<Job> => {
    return apiClient.post<Job>(API_ENDPOINTS.JOBS.RETRY(id));
  },

  /**
   * POST /api/v1/jobs/{id}/cancel
   * Cancel a pending or scheduled job
   */
  cancel: (id: string): Promise<Job> => {
    return apiClient.post<Job>(API_ENDPOINTS.JOBS.CANCEL(id));
  },

  /**
   * GET /api/v1/jobs/stats
   * Get job statistics
   */
  getStatistics: (): Promise<JobStatistics> => {
    return apiClient.get<JobStatistics>(API_ENDPOINTS.JOBS.STATS);
  },

  /**
   * GET /api/v1/jobs/status
   * Get job status counts
   */
  getStatusCounts: (): Promise<Record<JobStatus, number>> => {
    return apiClient.get<Record<JobStatus, number>>(API_ENDPOINTS.JOBS.STATUS);
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
    return apiClient.get<Job[]>(API_ENDPOINTS.JOBS.DLQ, params as Record<string, string | number>);
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
