/**
 * Schedules API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Schedule } from '@/lib/types';

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  cron_expression: string;
  timezone?: string;
  queue_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  enabled?: boolean; // kept for UI compatibility; backend uses is_active and defaults to true
  metadata?: Record<string, string>;
}

export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  cron_expression?: string;
  timezone?: string;
  queue_name?: string;
  job_type?: string; // stored inside payload_template.job_type
  payload?: Record<string, unknown>; // stored as payload_template
  metadata?: Record<string, string>;
}

export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  job_id: string;
  status: 'success' | 'failed';
  triggered_at: string;
  error?: string;
}

// Backend types
interface BackendSchedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  cron_expression: string;
  timezone: string;
  queue_name: string;
  payload_template: Record<string, unknown>;
  priority: number;
  max_retries: number;
  timeout_seconds: number;
  is_active: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  run_count: number;
  tags?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface BackendCreateScheduleResponse {
  id: string;
  name: string;
  cron_expression: string;
  next_run_at?: string | null;
}

interface BackendScheduleRunRecord {
  id: string;
  schedule_id: string;
  job_id: string | null;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function extractJobType(payloadTemplate: Record<string, unknown> | undefined): string {
  if (!payloadTemplate) return '';
  const jt = (payloadTemplate as { job_type?: unknown }).job_type;
  return typeof jt === 'string' ? jt : '';
}

function transformBackendSchedule(schedule: BackendSchedule): Schedule {
  const jobType = extractJobType(schedule.payload_template);
  return {
    id: schedule.id,
    organization_id: schedule.organization_id,
    name: schedule.name,
    description: schedule.description ?? undefined,
    cron_expression: schedule.cron_expression,
    timezone: schedule.timezone,
    queue: schedule.queue_name,
    job_type: jobType || 'job',
    payload: schedule.payload_template ?? {},
    enabled: schedule.is_active,
    last_run: schedule.last_run_at ?? undefined,
    last_run_status: undefined,
    last_job_id: undefined,
    next_run: schedule.next_run_at ?? undefined,
    created_at: schedule.created_at,
    updated_at: schedule.updated_at,
    metadata: (schedule.metadata as Record<string, string>) ?? undefined,
  };
}

function buildPayloadTemplate(
  payload: Record<string, unknown>,
  jobType?: string
): Record<string, unknown> {
  if (!jobType) return payload;
  const existing = (payload as { job_type?: unknown }).job_type;
  return typeof existing === 'string' ? payload : { ...payload, job_type: jobType };
}

export const schedulesAPI = {
  /**
   * GET /api/v1/schedules
   * List all schedules
   */
  list: async (): Promise<Schedule[]> => {
    const response = await apiClient.get<BackendSchedule[]>(API_ENDPOINTS.SCHEDULES.LIST);
    return response.map(transformBackendSchedule);
  },

  /**
   * POST /api/v1/schedules
   * Create a new schedule
   */
  create: async (data: CreateScheduleRequest): Promise<Schedule> => {
    const payload_template = buildPayloadTemplate(data.payload ?? {}, data.job_type);

    const createResponse = await apiClient.post<BackendCreateScheduleResponse>(
      API_ENDPOINTS.SCHEDULES.CREATE,
      {
        name: data.name,
        description: data.description,
        cron_expression: data.cron_expression,
        timezone: data.timezone,
        queue_name: data.queue_name,
        payload_template,
        metadata: data.metadata,
      }
    );

    // Fetch full schedule for consistent UI fields
    const schedule = await apiClient.get<BackendSchedule>(
      API_ENDPOINTS.SCHEDULES.GET(createResponse.id)
    );
    return transformBackendSchedule(schedule);
  },

  /**
   * GET /api/v1/schedules/{id}
   * Get schedule details by ID
   */
  get: async (id: string): Promise<Schedule> => {
    const response = await apiClient.get<BackendSchedule>(API_ENDPOINTS.SCHEDULES.GET(id));
    return transformBackendSchedule(response);
  },

  /**
   * PUT /api/v1/schedules/{id}
   * Update schedule
   */
  update: async (id: string, data: UpdateScheduleRequest): Promise<Schedule> => {
    const payload_template =
      data.payload !== undefined || data.job_type !== undefined
        ? buildPayloadTemplate(data.payload ?? {}, data.job_type)
        : undefined;

    const response = await apiClient.put<BackendSchedule>(API_ENDPOINTS.SCHEDULES.UPDATE(id), {
      name: data.name,
      description: data.description,
      cron_expression: data.cron_expression,
      timezone: data.timezone,
      queue_name: data.queue_name,
      payload_template,
      metadata: data.metadata,
    });

    return transformBackendSchedule(response);
  },

  /**
   * DELETE /api/v1/schedules/{id}
   * Delete a schedule
   */
  delete: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.SCHEDULES.DELETE(id));
  },

  /**
   * POST /api/v1/schedules/{id}/trigger
   * Manually trigger a schedule
   */
  trigger: (id: string): Promise<{ job_id: string }> => {
    return apiClient.post<{ job_id: string }>(API_ENDPOINTS.SCHEDULES.TRIGGER(id));
  },

  /**
   * POST /api/v1/schedules/{id}/pause
   * Pause a schedule (stop it from triggering)
   */
  pause: async (id: string): Promise<Schedule> => {
    const response = await apiClient.post<BackendSchedule>(API_ENDPOINTS.SCHEDULES.PAUSE(id));
    return transformBackendSchedule(response);
  },

  /**
   * POST /api/v1/schedules/{id}/resume
   * Resume a paused schedule
   */
  resume: async (id: string): Promise<Schedule> => {
    const response = await apiClient.post<BackendSchedule>(API_ENDPOINTS.SCHEDULES.RESUME(id));
    return transformBackendSchedule(response);
  },

  /**
   * GET /api/v1/schedules/{id}/history
   * Get schedule execution history
   */
  getHistory: async (id: string): Promise<ScheduleExecution[]> => {
    const response = await apiClient.get<BackendScheduleRunRecord[]>(
      API_ENDPOINTS.SCHEDULES.HISTORY(id)
    );
    return response
      .filter((r) => Boolean(r.job_id))
      .map((r) => ({
        id: r.id,
        schedule_id: r.schedule_id,
        job_id: r.job_id as string,
        status: (r.status === 'success' ? 'success' : 'failed') as 'success' | 'failed',
        triggered_at: r.started_at,
        error: r.error_message ?? undefined,
      }));
  },
};
