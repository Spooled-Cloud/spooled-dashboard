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
  /**
   * Outcome of the most recent delivery attempt.
   *
   * `auto_disabled` is set by the backend, not by a user: after
   * {@link WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive failed deliveries the webhook is disabled
   * automatically (`enabled` also becomes `false`) and stops receiving events until it is
   * re-enabled. It can persist after a re-enable, until the next delivery records a new outcome.
   */
  last_status?: 'success' | 'failed' | 'auto_disabled';
  /**
   * Consecutive failed deliveries. Counted once per DELIVERY, not once per retry attempt, so a
   * given amount of breakage produces a much smaller number than it used to. Any successful
   * delivery — including a successful manual retry — resets it to 0.
   */
  failure_count: number;
}

/** Consecutive failed deliveries after which the backend disables a webhook automatically. */
export const WEBHOOK_AUTO_DISABLE_THRESHOLD = 20;

/**
 * True when Spooled disabled this webhook itself after repeated delivery failures, as opposed to
 * the user turning it off.
 */
export function isAutoDisabled(webhook: Webhook): boolean {
  return !webhook.enabled && webhook.last_status === 'auto_disabled';
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
  /**
   * Signing secret. Three-state, and the states are NOT interchangeable:
   *
   * - omitted (`undefined`) — keep the current secret. This is the only safe default; never
   *   serialise an untouched secret field.
   * - `string` — replace the current secret.
   * - `null` — CLEAR the secret. Deliveries then go out unsigned, with no `X-Spooled-Signature`
   *   header, and the receiver can no longer verify that a payload came from Spooled. Only send
   *   `null` when the user deliberately asked to remove the secret.
   */
  secret?: string | null;
  /**
   * Re-enabling a webhook is charged against the plan webhook cap, so this can fail with
   * 429 `QUOTA_EXCEEDED` when the organization is already at its limit.
   */
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
   * Get webhook delivery history.
   *
   * This is a rolling window, not a permanent audit trail: it returns at most the newest 100
   * deliveries for the webhook, and older rows are removed by the retention sweep once they pass
   * the plan's `history_retention_days`.
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
