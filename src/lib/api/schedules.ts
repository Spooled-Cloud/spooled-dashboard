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
  enabled?: boolean;
  metadata?: Record<string, string>;
}

export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  cron_expression?: string;
  timezone?: string;
  queue_name?: string;
  job_type?: string;
  payload?: Record<string, unknown>;
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

export const schedulesAPI = {
  /**
   * GET /api/v1/schedules
   * List all schedules
   */
  list: (): Promise<Schedule[]> => {
    return apiClient.get<Schedule[]>(API_ENDPOINTS.SCHEDULES.LIST);
  },

  /**
   * POST /api/v1/schedules
   * Create a new schedule
   */
  create: (data: CreateScheduleRequest): Promise<Schedule> => {
    return apiClient.post<Schedule>(API_ENDPOINTS.SCHEDULES.CREATE, data);
  },

  /**
   * GET /api/v1/schedules/{id}
   * Get schedule details by ID
   */
  get: (id: string): Promise<Schedule> => {
    return apiClient.get<Schedule>(API_ENDPOINTS.SCHEDULES.GET(id));
  },

  /**
   * PUT /api/v1/schedules/{id}
   * Update schedule
   */
  update: (id: string, data: UpdateScheduleRequest): Promise<Schedule> => {
    return apiClient.put<Schedule>(API_ENDPOINTS.SCHEDULES.UPDATE(id), data);
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
  pause: (id: string): Promise<Schedule> => {
    return apiClient.post<Schedule>(API_ENDPOINTS.SCHEDULES.PAUSE(id));
  },

  /**
   * POST /api/v1/schedules/{id}/resume
   * Resume a paused schedule
   */
  resume: (id: string): Promise<Schedule> => {
    return apiClient.post<Schedule>(API_ENDPOINTS.SCHEDULES.RESUME(id));
  },

  /**
   * GET /api/v1/schedules/{id}/history
   * Get schedule execution history
   */
  getHistory: (id: string): Promise<ScheduleExecution[]> => {
    return apiClient.get<ScheduleExecution[]>(API_ENDPOINTS.SCHEDULES.HISTORY(id));
  },
};
