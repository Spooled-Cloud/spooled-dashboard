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
  /**
   * Body Spooled sends. Absent on a backend older than 0.1.122, which only knows `json`:
   * treat a missing value as "formats are not supported here", not as `json`.
   */
  format?: WebhookFormat;
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
  | 'schedule.triggered'
  // Added in backend 0.1.122
  | 'job.deadlettered'
  | 'job.retried'
  | 'workflow.completed'
  | 'workflow.failed';

/**
 * What an outgoing webhook delivers. `json` is the signed Spooled envelope; the others turn
 * an event into the message a chat service's incoming-webhook URL accepts.
 */
export type WebhookFormat = 'json' | 'slack' | 'discord' | 'teams';

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled?: boolean;
  /** Omit for `json`: a backend older than 0.1.122 does not know the field. */
  format?: WebhookFormat;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  /** Omit to keep the current format. */
  format?: WebhookFormat;
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
  payload: unknown;
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

/** `POST /outgoing-webhooks/{id}/retry/{delivery_id}`: `success` is whether the endpoint accepted it. */
export interface RetryDeliveryResponse {
  success: boolean;
  message: string;
}

/**
 * The backend refuses a manual retry of a delivery that already made this many attempts
 * (`MAX_MANUAL_RETRY_ATTEMPTS`), and of a delivery that succeeded.
 */
export const WEBHOOK_MANUAL_RETRY_MAX_ATTEMPTS = 10;

/** What happened to a request on `POST /webhooks/{org_id}/custom`. */
export type InboundDeliveryStatus = 'created' | 'duplicate';

/** One accepted request of the inbound webhook log (`GET /webhooks/deliveries`). */
export interface InboundWebhookDelivery {
  id: string;
  provider: string;
  event_type: string;
  /** Queue of the job the request created or matched. */
  matched_queue: string | null;
  /** `null` for entries recorded before 0.1.122. */
  job_id: string | null;
  /** `created` (new job) or `duplicate` (idempotency key matched); `null` before 0.1.122. */
  status: InboundDeliveryStatus | null;
  created_at: string;
}

export interface InboundDeliveriesParams {
  status?: InboundDeliveryStatus;
  /** RFC 3339 instant; only entries received at or after it. */
  since?: string;
  /** Only requests whose job went to this queue. */
  queue_name?: string;
  /** 1..100 (default 50). */
  limit?: number;
  offset?: number;
}

interface BackendInboundDelivery {
  id: string;
  provider: string;
  event_type: string;
  matched_queue?: string | null;
  job_id?: string | null;
  status?: string | null;
  created_at: string;
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

  /**
   * POST /api/v1/outgoing-webhooks/{id}/retry/{delivery_id}
   * Send a failed delivery again, once, now. HTTP 200 means the retry was attempted: whether
   * the endpoint accepted it is `success`. A successful delivery, or one that already made
   * {@link WEBHOOK_MANUAL_RETRY_MAX_ATTEMPTS} attempts, is a 400 with the reason in `message`.
   */
  retryDelivery: (id: string, deliveryId: string): Promise<RetryDeliveryResponse> => {
    return apiClient.post<RetryDeliveryResponse>(
      API_ENDPOINTS.WEBHOOKS.RETRY_DELIVERY(id, deliveryId)
    );
  },
};

function toInboundStatus(value: unknown): InboundDeliveryStatus | null {
  return value === 'created' || value === 'duplicate' ? value : null;
}

export const inboundWebhooksAPI = {
  /**
   * GET /api/v1/webhooks/deliveries
   * The inbound webhook log: accepted requests to `POST /webhooks/{org_id}/custom`, newest
   * first. A bare array with no total. Unrestricted API keys only (403 for a queue-scoped key);
   * a backend older than 0.1.122 has no such route (404).
   */
  listDeliveries: async (params?: InboundDeliveriesParams): Promise<InboundWebhookDelivery[]> => {
    const rows = await apiClient.get<BackendInboundDelivery[]>(
      API_ENDPOINTS.INBOUND_WEBHOOKS.DELIVERIES,
      {
        status: params?.status,
        since: params?.since,
        queue_name: params?.queue_name,
        limit: params?.limit,
        offset: params?.offset,
      }
    );
    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      event_type: row.event_type,
      matched_queue: row.matched_queue ?? null,
      job_id: row.job_id ?? null,
      status: toInboundStatus(row.status),
      created_at: row.created_at,
    }));
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
  {
    value: 'job.deadlettered',
    label: 'Job Dead-lettered',
    description: 'When a job runs out of retries and moves to the dead-letter queue',
  },
  {
    value: 'job.retried',
    label: 'Job Retried',
    description: 'When a failed or dead-lettered job is put back in the queue by a retry',
  },
  {
    value: 'workflow.completed',
    label: 'Workflow Completed',
    description: 'When every job of a workflow has completed (sent within about 10 seconds)',
  },
  {
    value: 'workflow.failed',
    label: 'Workflow Failed',
    description: 'When a workflow ends with a failed job (sent within about 10 seconds)',
  },
];

/** The format a webhook has unless one is chosen. */
export const DEFAULT_WEBHOOK_FORMAT: WebhookFormat = 'json';

/** Body formats of an outgoing webhook (backend 0.1.122). */
export const WEBHOOK_FORMATS: { value: WebhookFormat; label: string; description: string }[] = [
  {
    value: 'json',
    label: 'JSON',
    description: 'The signed Spooled envelope: id, event, created_at and data.',
  },
  {
    value: 'slack',
    label: 'Slack',
    description: 'A Slack message ({"text": ...}). Use a Slack incoming webhook URL.',
  },
  {
    value: 'discord',
    label: 'Discord',
    description:
      'A Discord message ({"content": ...}, at most 2000 characters, mentions never ping). Use a Discord webhook URL.',
  },
  {
    value: 'teams',
    label: 'Microsoft Teams',
    description:
      'A Teams MessageCard. It works with Office 365 connector webhook URLs; Power Automate Workflows URLs reject it.',
  },
];

/** Display name of a format; unknown values (a newer backend) are shown as they are. */
export function webhookFormatLabel(format: string): string {
  return WEBHOOK_FORMATS.find((f) => f.value === format)?.label ?? format;
}
