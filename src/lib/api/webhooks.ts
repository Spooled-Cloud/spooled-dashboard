/**
 * Webhooks API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';

export interface Webhook {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  secret?: string;
  events: WebhookEvent[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  last_status?: 'success' | 'failed';
  failure_count: number;
}

export type WebhookEvent =
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'queue.paused'
  | 'queue.resumed'
  | 'worker.registered'
  | 'worker.deregistered'
  | 'schedule.triggered';

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled?: boolean;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  enabled?: boolean;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  status_code?: number;
  response_body?: string;
  error?: string;
  attempts: number;
  created_at: string;
  delivered_at?: string;
}

export interface TestWebhookResponse {
  success: boolean;
  status_code?: number;
  response_time_ms: number;
  error?: string;
}

export const webhooksAPI = {
  /**
   * GET /api/v1/webhooks
   * List all webhooks
   */
  list: (): Promise<Webhook[]> => {
    return apiClient.get<Webhook[]>(API_ENDPOINTS.WEBHOOKS.LIST);
  },

  /**
   * POST /api/v1/webhooks
   * Create a new webhook
   */
  create: (data: CreateWebhookRequest): Promise<Webhook> => {
    return apiClient.post<Webhook>(API_ENDPOINTS.WEBHOOKS.CREATE, data);
  },

  /**
   * GET /api/v1/webhooks/{id}
   * Get webhook details
   */
  get: (id: string): Promise<Webhook> => {
    return apiClient.get<Webhook>(API_ENDPOINTS.WEBHOOKS.GET(id));
  },

  /**
   * PUT /api/v1/webhooks/{id}
   * Update webhook
   */
  update: (id: string, data: UpdateWebhookRequest): Promise<Webhook> => {
    return apiClient.put<Webhook>(API_ENDPOINTS.WEBHOOKS.UPDATE(id), data);
  },

  /**
   * DELETE /api/v1/webhooks/{id}
   * Delete a webhook
   */
  delete: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.WEBHOOKS.DELETE(id));
  },

  /**
   * POST /api/v1/webhooks/{id}/test
   * Test a webhook with a sample payload
   */
  test: (id: string): Promise<TestWebhookResponse> => {
    return apiClient.post<TestWebhookResponse>(API_ENDPOINTS.WEBHOOKS.TEST(id));
  },

  /**
   * GET /api/v1/webhooks/{id}/deliveries
   * Get webhook delivery history
   */
  getDeliveries: (id: string): Promise<WebhookDelivery[]> => {
    return apiClient.get<WebhookDelivery[]>(API_ENDPOINTS.WEBHOOKS.DELIVERIES(id));
  },
};

/**
 * Available webhook events
 */
export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'job.created', label: 'Job Created', description: 'When a new job is enqueued' },
  { value: 'job.started', label: 'Job Started', description: 'When a job starts processing' },
  {
    value: 'job.completed',
    label: 'Job Completed',
    description: 'When a job completes successfully',
  },
  { value: 'job.failed', label: 'Job Failed', description: 'When a job fails' },
  { value: 'job.cancelled', label: 'Job Cancelled', description: 'When a job is cancelled' },
  { value: 'queue.paused', label: 'Queue Paused', description: 'When a queue is paused' },
  { value: 'queue.resumed', label: 'Queue Resumed', description: 'When a queue is resumed' },
  {
    value: 'worker.registered',
    label: 'Worker Registered',
    description: 'When a new worker connects',
  },
  {
    value: 'worker.deregistered',
    label: 'Worker Deregistered',
    description: 'When a worker disconnects',
  },
  {
    value: 'schedule.triggered',
    label: 'Schedule Triggered',
    description: 'When a scheduled job is triggered',
  },
];
