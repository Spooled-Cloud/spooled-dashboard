/**
 * MSW Request Handlers
 * Mock API responses for testing
 */

import { http, HttpResponse } from 'msw';

const API_BASE = 'https://api.spooled.cloud';

// Mock data
export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'org_admin',
  permissions: ['jobs:read', 'jobs:write', 'queues:read', 'queues:write'],
  organization_id: 'org-1',
  organization_name: 'Test Org',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  email_verified: true,
  two_factor_enabled: false,
  status: 'active',
};

export const mockOrganization = {
  id: 'org-1',
  name: 'Test Organization',
  slug: 'test-org',
  // Fields of the backend Organization (GET /organizations/{id})
  plan_tier: 'pro',
  billing_email: 'billing@example.com',
  billing_email_verified_at: null,
  pending_billing_email: null,
  settings: {},
  plan: 'professional',
  status: 'active',
  member_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/**
 * An organization with a billing-email change that waits for its confirmation code:
 * `billing_email` is still the verified address, `pending_billing_email` the new one.
 * GET /organizations/org-pending returns it.
 */
export const mockOrganizationPendingBillingEmail = {
  ...mockOrganization,
  id: 'org-pending',
  billing_email_verified_at: '2026-10-10T00:00:00Z',
  pending_billing_email: 'new-billing@example.com',
};

export const mockJobs = [
  {
    id: 'job-1',
    organization_id: 'org-1',
    queue: 'default',
    job_type: 'send_email',
    payload: { to: 'user@example.com' },
    status: 'completed',
    priority: 0,
    attempt: 1,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:01:00Z',
  },
  {
    id: 'job-2',
    organization_id: 'org-1',
    queue: 'default',
    job_type: 'process_image',
    payload: { url: 'https://example.com/image.jpg' },
    status: 'pending',
    priority: 1,
    attempt: 0,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2024-01-01T00:02:00Z',
  },
  {
    id: 'job-3',
    organization_id: 'org-1',
    queue: 'emails',
    job_type: 'send_notification',
    payload: { user_id: '123' },
    status: 'failed',
    priority: 0,
    attempt: 3,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2024-01-01T00:03:00Z',
    failed_at: '2024-01-01T00:04:00Z',
    error: { type: 'NetworkError', message: 'Connection refused' },
  },
  {
    id: 'job-4',
    organization_id: 'org-1',
    queue: 'retry-q',
    job_type: 'retry_email',
    payload: { to: 'retry@example.com' },
    status: 'pending',
    priority: 0,
    attempt: 1,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2024-01-01T00:04:00Z',
    scheduled_at: '2024-01-01T00:05:00Z',
    error: { type: 'Error', message: 'timeout' },
  },
];

// Backend format for queue list (QueueConfigSummary)
export const mockQueuesSummary = [
  {
    queue_name: 'default',
    max_retries: 3,
    default_timeout: 30,
    rate_limit: null,
    enabled: true,
  },
  {
    queue_name: 'emails',
    max_retries: 5,
    default_timeout: 60,
    rate_limit: 100,
    enabled: true,
  },
];

// Backend format for queue details (QueueConfig)
export const mockQueueConfigs: Record<
  string,
  {
    id: string;
    organization_id: string;
    queue_name: string;
    max_retries: number;
    default_timeout: number;
    rate_limit: number | null;
    enabled: boolean;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }
> = {
  default: {
    id: 'queue-1',
    organization_id: 'org-1',
    queue_name: 'default',
    max_retries: 3,
    default_timeout: 30,
    rate_limit: null,
    enabled: true,
    settings: {
      description: 'Default queue',
      concurrency: 10,
      retry_delay_ms: 1000,
      backoff_multiplier: 2,
      max_retry_delay_ms: 60000,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  emails: {
    id: 'queue-2',
    organization_id: 'org-1',
    queue_name: 'emails',
    max_retries: 5,
    default_timeout: 60,
    rate_limit: 100,
    enabled: true,
    settings: {
      description: 'Email processing queue',
      concurrency: 5,
      retry_delay_ms: 2000,
      backoff_multiplier: 2,
      max_retry_delay_ms: 120000,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

/**
 * A WorkerSummary / WorkerResponse as backend 0.1.121 sends it: the counters do not exist
 * there, so a dashboard that shows them must show nothing instead of a made-up 0.
 */
export function withoutWorkerCounters<T extends object>(
  worker: T
): Omit<T, 'jobs_processed' | 'jobs_failed'> {
  const rest = { ...worker } as Record<string, unknown>;
  delete rest.jobs_processed;
  delete rest.jobs_failed;
  return rest as Omit<T, 'jobs_processed' | 'jobs_failed'>;
}

// Frontend format for backwards compatibility with existing tests
export const mockQueues = [
  {
    name: 'default',
    organization_id: 'org-1',
    description: 'Default queue',
    concurrency: 10,
    max_retries: 3,
    retry_delay_ms: 1000,
    backoff_multiplier: 2,
    max_retry_delay_ms: 60000,
    job_timeout_ms: 30000,
    paused: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    name: 'emails',
    organization_id: 'org-1',
    description: 'Email processing queue',
    concurrency: 5,
    max_retries: 5,
    retry_delay_ms: 2000,
    backoff_multiplier: 2,
    max_retry_delay_ms: 120000,
    job_timeout_ms: 60000,
    paused: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Backend format for workers (WorkerSummary)
export const mockWorkersSummary = [
  {
    id: 'worker-1',
    queue_name: 'default',
    hostname: 'worker-node-1',
    status: 'healthy',
    current_jobs: 3,
    max_concurrency: 10,
    last_heartbeat: new Date().toISOString(),
    // Backend 0.1.122: counters kept while the worker holds a live lease
    jobs_processed: 1280,
    jobs_failed: 20,
  },
  {
    id: 'worker-2',
    queue_name: 'default',
    hostname: 'worker-node-2',
    status: 'healthy',
    current_jobs: 0,
    max_concurrency: 5,
    last_heartbeat: new Date().toISOString(),
    jobs_processed: 0,
    jobs_failed: 0,
  },
];

// Backend format for worker detail (WorkerResponse)
export const mockWorkerDetails: Record<
  string,
  {
    id: string;
    organization_id: string;
    queue_name: string;
    queue_names: string[];
    hostname: string;
    worker_type: string | null;
    max_concurrency: number;
    current_jobs: number;
    status: string;
    last_heartbeat: string;
    metadata: Record<string, unknown>;
    version: string | null;
    registered_at: string;
    updated_at: string;
    jobs_processed: number;
    jobs_failed: number;
  }
> = {
  'worker-1': {
    id: 'worker-1',
    organization_id: 'org-1',
    queue_name: 'default',
    queue_names: ['default', 'emails'],
    hostname: 'worker-node-1',
    worker_type: 'http',
    max_concurrency: 10,
    current_jobs: 3,
    status: 'healthy',
    last_heartbeat: new Date().toISOString(),
    metadata: {},
    version: '1.0.0',
    registered_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    jobs_processed: 1280,
    jobs_failed: 20,
  },
  'worker-2': {
    id: 'worker-2',
    organization_id: 'org-1',
    queue_name: 'default',
    queue_names: ['default'],
    hostname: 'worker-node-2',
    worker_type: 'http',
    max_concurrency: 5,
    current_jobs: 0,
    status: 'healthy',
    last_heartbeat: new Date().toISOString(),
    metadata: {},
    version: '1.0.0',
    registered_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    jobs_processed: 0,
    jobs_failed: 0,
  },
};

// Frontend format for backwards compatibility with existing tests
export const mockWorkers = [
  {
    id: 'worker-1',
    organization_id: 'org-1',
    hostname: 'worker-node-1',
    queues: ['default', 'emails'],
    concurrency: 10,
    current_jobs: 3,
    status: 'active',
    last_heartbeat: new Date().toISOString(),
    started_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'worker-2',
    organization_id: 'org-1',
    hostname: 'worker-node-2',
    queues: ['default'],
    concurrency: 5,
    current_jobs: 0,
    status: 'idle',
    last_heartbeat: new Date().toISOString(),
    started_at: '2024-01-01T00:00:00Z',
  },
];

export const mockSchedules = [
  {
    id: 'schedule-1',
    organization_id: 'org-1',
    name: 'Daily Cleanup',
    description: 'Clean up old records daily',
    cron_expression: '0 0 * * *',
    timezone: 'UTC',
    queue: 'default',
    job_type: 'cleanup',
    payload: {},
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

export const mockWorkflows = [
  {
    id: 'workflow-1',
    organization_id: 'org-1',
    name: 'Data Pipeline',
    description: 'Process data in stages',
    status: 'completed',
    jobs: mockJobs.slice(0, 2),
    dependencies: [],
    created_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:05:00Z',
  },
];

export const mockDashboard = {
  system: {
    version: '1.0.0',
    uptime_seconds: 86400,
    started_at: '2024-01-01T00:00:00Z',
    database_status: 'ok',
    cache_status: 'ok',
    environment: 'test',
  },
  jobs: {
    total: 1000,
    pending: 50,
    processing: 10,
    completed_24h: 900,
    failed_24h: 30,
    deadletter: 5,
    avg_wait_time_ms: 250,
    avg_processing_time_ms: 1500,
  },
  queues: [
    { name: 'default', pending: 30, processing: 5, paused: false },
    { name: 'emails', pending: 20, processing: 5, paused: false },
  ],
  workers: {
    total: 2,
    healthy: 1,
    unhealthy: 1,
  },
  recent_activity: {
    jobs_created_1h: 120,
    jobs_completed_1h: 110,
    jobs_failed_1h: 5,
  },
};

export const mockApiKeys = [
  {
    id: 'key-1',
    name: 'Production API Key',
    queues: ['default', 'printer'],
    rate_limit: null, // requests per MINUTE; can only lower the plan limit
    is_system: false,
    is_active: true,
    expires_at: null,
    created_at: '2024-01-01T00:00:00Z',
    last_used: '2024-01-01T12:00:00Z',
  },
  {
    id: 'key-2',
    name: 'Dashboard session',
    queues: ['*'],
    rate_limit: 120,
    is_system: true,
    is_active: true,
    expires_at: null,
    created_at: '2024-01-02T00:00:00Z',
    last_used: null,
  },
];

export const mockWebhooks = [
  {
    id: 'webhook-1',
    organization_id: 'org-1',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/xxx',
    events: ['job.completed', 'job.failed'],
    // Backend 0.1.122 returns the delivery format on every webhook ("json" by default)
    format: 'slack',
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    failure_count: 0,
  },
];

export const mockBillingStatusFree = {
  plan_tier: 'free',
  stripe_subscription_id: null,
  stripe_subscription_status: null,
  stripe_current_period_end: null,
  stripe_cancel_at_period_end: null,
  has_stripe_customer: false,
};

export const mockBillingStatusWithCustomer = {
  plan_tier: 'starter',
  stripe_subscription_id: 'sub_test_123',
  stripe_subscription_status: 'active',
  stripe_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  stripe_cancel_at_period_end: false,
  has_stripe_customer: true,
};

const MOCK_JOB_STATUSES = [
  'pending',
  'scheduled',
  'processing',
  'completed',
  'failed',
  'deadletter',
  'cancelled',
];

/** `GET /jobs/{id}/history` rows per job id, as `job_history` rows leave the backend. */
export const mockJobHistory: Record<string, Array<Record<string, unknown>>> = {
  // job-1 completed after one retry
  'job-1': [
    {
      id: 'hist-1',
      job_id: 'job-1',
      event_type: 'processing',
      worker_id: 'worker-1',
      details: {
        worker_id: 'worker-1',
        lease_id: 'lease-1',
        batch_claim: false,
        organization_id: 'org-1',
      },
      created_at: '2024-01-01T00:00:10Z',
    },
    {
      id: 'hist-2',
      job_id: 'job-1',
      event_type: 'retry_scheduled',
      worker_id: 'worker-1',
      details: {
        error: 'Connection refused',
        retry_count: 1,
        next_run: '2024-01-01T00:00:40Z',
        organization_id: 'org-1',
      },
      created_at: '2024-01-01T00:00:20Z',
    },
    {
      id: 'hist-3',
      job_id: 'job-1',
      event_type: 'processing',
      worker_id: 'worker-2',
      details: { worker_id: 'worker-2', lease_id: 'lease-2', organization_id: 'org-1' },
      created_at: '2024-01-01T00:00:45Z',
    },
    {
      id: 'hist-4',
      job_id: 'job-1',
      event_type: 'completed',
      worker_id: 'worker-2',
      details: { organization_id: 'org-1' },
      created_at: '2024-01-01T00:01:00Z',
    },
  ],
};

/** `GET /webhooks/deliveries` rows (the inbound webhook log), newest first. */
export const mockInboundDeliveries = [
  {
    id: 'inbound-3',
    provider: 'custom',
    event_type: 'order.created',
    matched_queue: 'orders',
    job_id: 'job-in-3',
    status: 'created',
    created_at: '2026-10-11T12:00:00Z',
  },
  {
    id: 'inbound-2',
    provider: 'custom',
    event_type: 'order.created',
    matched_queue: 'orders',
    job_id: 'job-in-1',
    status: 'duplicate',
    created_at: '2026-10-11T11:00:00Z',
  },
  {
    // recorded before 0.1.122: no job and no outcome
    id: 'inbound-1',
    provider: 'custom',
    event_type: 'custom',
    matched_queue: 'default',
    job_id: null,
    status: null,
    created_at: '2026-10-10T09:00:00Z',
  },
];

const usageItem = (current: number, limit: number | null) => ({
  current,
  limit,
  percentage: limit ? (current / limit) * 100 : null,
  is_disabled: false,
});

/** `GET /organizations/usage` (backend UsageInfo): plan limits and the usage against them. */
export const mockUsage = {
  plan: 'pro',
  plan_display_name: 'Pro',
  limits: {
    tier: 'pro',
    display_name: 'Pro',
    max_jobs_per_day: 1_000_000,
    max_active_jobs: 10_000,
    max_queues: 50,
    max_workers: 50,
    max_api_keys: 20,
    max_schedules: 50,
    max_workflows: 50,
    max_webhooks: 20,
    max_payload_size_bytes: 1_048_576,
    rate_limit_requests_per_second: 100,
    rate_limit_burst: 200,
    job_retention_days: 30,
    history_retention_days: 30,
  },
  usage: {
    jobs_today: usageItem(1200, 1_000_000),
    active_jobs: usageItem(60, 10_000),
    queues: usageItem(2, 50),
    workers: usageItem(2, 50),
    api_keys: usageItem(2, 20),
    schedules: usageItem(1, 50),
    workflows: usageItem(1, 50),
    webhooks: usageItem(1, 20),
  },
  warnings: [],
};

// Handlers
export const handlers = [
  // Auth
  http.post(`${API_BASE}/api/v1/auth/login`, () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      user: mockUser,
    });
  }),

  http.post(`${API_BASE}/api/v1/auth/email/start`, () => {
    return HttpResponse.json({ sent: true });
  }),

  http.post(`${API_BASE}/api/v1/auth/email/verify`, () => {
    // Backend VerifyEmailResponse is internally tagged: existing account -> type "login"
    return HttpResponse.json({
      type: 'login',
      access_token: 'email-access-token',
      refresh_token: 'email-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_expires_in: 2592000,
    });
  }),

  http.post(`${API_BASE}/api/v1/auth/refresh`, () => {
    // Backend RefreshTokenResponse has no refresh_token (the refresh token is not rotated)
    return HttpResponse.json({
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }),

  http.get(`${API_BASE}/api/v1/auth/me`, () => {
    // Backend CurrentUserResponse fields, plus the legacy mockUser fields some tests read
    return HttpResponse.json({
      ...mockUser,
      organization_id: 'org-1',
      api_key_id: 'key-1',
      queues: ['*'],
      issued_at: '2024-01-01T00:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
    });
  }),

  // Dashboard
  http.get(`${API_BASE}/api/v1/dashboard`, () => {
    return HttpResponse.json(mockDashboard);
  }),

  // Jobs - put specific routes BEFORE parameterized routes
  http.get(`${API_BASE}/api/v1/jobs/stats`, () => {
    return HttpResponse.json({
      total: 1000,
      pending: 50,
      scheduled: 5,
      processing: 10,
      completed: 900,
      failed: 30,
      cancelled: 5,
      deadletter: 5,
    });
  }),

  http.get(`${API_BASE}/api/v1/jobs/dlq`, () => {
    // Backend list_dlq returns JobSummary[], same as GET /jobs.
    return HttpResponse.json([
      {
        id: 'job-dlq-1',
        queue_name: 'emails',
        status: 'deadletter',
        priority: 0,
        attempt: 3,
        max_retries: 3,
        job_type: 'send_notification',
        last_error: 'Connection refused',
        created_at: '2024-01-01T00:03:00Z',
        scheduled_at: null,
        started_at: '2024-01-01T00:03:30Z',
        completed_at: null,
      },
    ]);
  }),

  http.get(`${API_BASE}/api/v1/jobs/status`, ({ request }) => {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids');
    if (!idsParam) {
      return HttpResponse.json([]);
    }
    const ids = idsParam.split(',').filter(Boolean);
    // Return mock status for each requested ID
    const statuses = ids.map((id) => {
      const job = mockJobs.find((j) => j.id === id);
      return {
        id,
        status: job?.status || 'pending',
        queue_name: job?.queue || 'default',
        retry_count: job?.attempt ?? 0,
        created_at: job?.created_at || new Date().toISOString(),
        completed_at: job?.completed_at ?? null,
      };
    });
    return HttpResponse.json(statuses);
  }),

  http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const queueName = url.searchParams.get('queue_name');
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const jobType = url.searchParams.get('job_type');
    const tag = url.searchParams.get('tag');
    const createdAfter = url.searchParams.get('created_after');
    const createdBefore = url.searchParams.get('created_before');
    const limit = Number(url.searchParams.get('limit') || '50');
    const offset = Number(url.searchParams.get('offset') || '0');

    // Backend 0.1.122: status is one value or a comma list; an unknown entry is a 400.
    const statuses = (statusParam ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const unknownStatus = statuses.find((s) => !MOCK_JOB_STATUSES.includes(s));
    if (unknownStatus) {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: `Invalid status filter '${unknownStatus}': expected one or more of ${MOCK_JOB_STATUSES.join(', ')} (comma-separated)`,
        },
        { status: 400 }
      );
    }

    let filtered = [...mockJobs];
    if (statuses.length > 0) {
      filtered = filtered.filter((j) => statuses.includes(j.status));
    }
    if (queueName) {
      filtered = filtered.filter((j) => j.queue === queueName);
    }
    // q: job id PREFIX, or a substring of the queue name or of payload.job_type (any case)
    if (q) {
      filtered = filtered.filter(
        (j) =>
          j.id.toLowerCase().startsWith(q) ||
          j.queue.toLowerCase().includes(q) ||
          j.job_type.toLowerCase().includes(q)
      );
    }
    if (jobType) {
      filtered = filtered.filter((j) => j.job_type === jobType);
    }
    // tag: `jsonb ?` - an element of a tags array or a key of a tags object
    if (tag) {
      filtered = filtered.filter((j) => {
        const tags = (j as { metadata?: unknown }).metadata;
        if (Array.isArray(tags)) return tags.includes(tag);
        return tags !== null && typeof tags === 'object' && tag in (tags as object);
      });
    }
    // created_after is inclusive, created_before exclusive
    if (createdAfter) {
      filtered = filtered.filter((j) => Date.parse(j.created_at) >= Date.parse(createdAfter));
    }
    if (createdBefore) {
      filtered = filtered.filter((j) => Date.parse(j.created_at) < Date.parse(createdBefore));
    }

    // Backend returns JobSummary[] (not paginated object)
    const summaries = filtered.map((j) => ({
      id: j.id,
      queue_name: j.queue,
      status: j.status,
      priority: j.priority,
      attempt: j.attempt,
      max_retries: j.max_retries,
      job_type: j.job_type,
      created_at: j.created_at,
      scheduled_at: (j as { scheduled_at?: string }).scheduled_at ?? null,
      started_at: (j as { started_at?: string }).started_at ?? null,
      completed_at: (j as { completed_at?: string }).completed_at ?? null,
    }));

    // X-Has-More: another row matches after this page
    return HttpResponse.json(summaries.slice(offset, offset + limit), {
      headers: { 'X-Has-More': String(summaries.length > offset + limit) },
    });
  }),

  // GET /jobs/{id}/history (backend 0.1.122): the job's recorded events, oldest first
  http.get(`${API_BASE}/api/v1/jobs/:id/history`, ({ params, request }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || '100');
    const offset = Number(url.searchParams.get('offset') || '0');
    const events = [...(mockJobHistory[job.id] ?? [])];
    if (url.searchParams.get('order_dir') === 'desc') events.reverse();
    return HttpResponse.json(events.slice(offset, offset + limit), {
      headers: { 'X-Has-More': String(events.length > offset + limit) },
    });
  }),

  http.get(`${API_BASE}/api/v1/jobs/:id`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    // Backend returns full Job with queue_name/retry_count/timeout_seconds/etc.
    return HttpResponse.json({
      id: job.id,
      organization_id: 'org-1',
      queue_name: job.queue,
      status: job.status,
      payload: { ...(job.payload as Record<string, unknown>), job_type: job.job_type },
      result: null,
      retry_count: job.attempt,
      max_retries: job.max_retries,
      last_error: job.error?.message ?? null,
      created_at: job.created_at,
      scheduled_at: (job as { scheduled_at?: string }).scheduled_at ?? null,
      started_at: (job as { started_at?: string }).started_at ?? null,
      completed_at: (job as { completed_at?: string }).completed_at ?? null,
      expires_at: null,
      priority: job.priority,
      tags: (job as { metadata?: Record<string, string> }).metadata ?? null,
      timeout_seconds: 300,
      parent_job_id: (job as { parent_job_id?: string }).parent_job_id ?? null,
      completion_webhook: null,
      assigned_worker_id: null,
      lease_id: null,
      lease_expires_at: null,
      idempotency_key: (job as { idempotency_key?: string }).idempotency_key ?? null,
      updated_at: job.created_at,
      workflow_id: (job as { workflow_id?: string }).workflow_id ?? null,
      dependency_mode: null,
      dependencies_met: null,
    });
  }),

  http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    // Backend returns CreateJobResponse { id, created }
    return HttpResponse.json(
      {
        id: `job-${Date.now()}`,
        created: true,
        // keep body unused; backend ignores unknowns anyway
        _debug_received: body,
      },
      { status: 201 }
    );
  }),

  http.post(`${API_BASE}/api/v1/jobs/:id/retry`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    return HttpResponse.json({
      id: job.id,
      organization_id: 'org-1',
      queue_name: job.queue,
      status: 'pending',
      payload: { ...(job.payload as Record<string, unknown>), job_type: job.job_type },
      result: null,
      retry_count: job.attempt + 1,
      max_retries: job.max_retries,
      last_error: null,
      created_at: job.created_at,
      scheduled_at: (job as { scheduled_at?: string }).scheduled_at ?? null,
      started_at: null,
      completed_at: null,
      expires_at: null,
      priority: job.priority,
      tags: (job as { metadata?: Record<string, string> }).metadata ?? null,
      timeout_seconds: 300,
      parent_job_id: (job as { parent_job_id?: string }).parent_job_id ?? null,
      completion_webhook: null,
      assigned_worker_id: null,
      lease_id: null,
      lease_expires_at: null,
      idempotency_key: (job as { idempotency_key?: string }).idempotency_key ?? null,
      updated_at: new Date().toISOString(),
      workflow_id: (job as { workflow_id?: string }).workflow_id ?? null,
      dependency_mode: null,
      dependencies_met: null,
    });
  }),

  http.delete(`${API_BASE}/api/v1/jobs/:id`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    // DELETE /jobs/{id} only cancels: pending and scheduled jobs. Any other status is a 409.
    if (job.status !== 'pending' && job.status !== 'scheduled') {
      return HttpResponse.json(
        {
          code: 'CONFLICT',
          message: 'Job cannot be cancelled (not in pending or scheduled state)',
        },
        { status: 409 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Queues - return backend format (API transforms to frontend format)
  http.get(`${API_BASE}/api/v1/queues`, () => {
    // Return QueueConfigSummary[] format
    return HttpResponse.json(mockQueuesSummary);
  }),

  http.get(`${API_BASE}/api/v1/queues/:name`, ({ params }) => {
    const name = params.name as string;
    const queue = mockQueueConfigs[name];
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    // Return QueueConfig format
    return HttpResponse.json(queue);
  }),

  http.put(`${API_BASE}/api/v1/queues/:name/config`, async ({ params, request }) => {
    const name = params.name as string;
    const existingQueue = mockQueueConfigs[name];
    const body = (await request.json()) as Record<string, unknown>;

    if (existingQueue) {
      // Update existing queue - return QueueConfig format with updates
      return HttpResponse.json({
        ...existingQueue,
        ...body,
        settings: { ...existingQueue.settings, ...(body.settings as Record<string, unknown>) },
        updated_at: new Date().toISOString(),
      });
    } else {
      // Create new queue - return QueueConfig format
      const newQueue = {
        id: `queue-${Date.now()}`,
        organization_id: 'org-1',
        queue_name: name,
        max_retries: (body.max_retries as number) || 3,
        default_timeout: (body.default_timeout as number) || 300,
        rate_limit: null,
        enabled: true,
        settings: body.settings || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return HttpResponse.json(newQueue, { status: 201 });
    }
  }),

  http.post(`${API_BASE}/api/v1/queues/:name/pause`, ({ params }) => {
    const name = params.name as string;
    const queue = mockQueueConfigs[name];
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    // Return PauseQueueResponse format
    return HttpResponse.json({
      queue_name: name,
      paused: true,
      paused_at: new Date().toISOString(),
      reason: null,
    });
  }),

  http.post(`${API_BASE}/api/v1/queues/:name/resume`, ({ params }) => {
    const name = params.name as string;
    const queue = mockQueueConfigs[name];
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    // Return ResumeQueueResponse format
    return HttpResponse.json({
      queue_name: name,
      resumed: true,
      paused_duration_secs: 3600,
    });
  }),

  http.delete(`${API_BASE}/api/v1/queues/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Note: Queue purge endpoint does not exist in backend.
  // Use Jobs DLQ purge instead: POST /api/v1/jobs/dlq/purge

  http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) => {
    // Return QueueStats backend format
    return HttpResponse.json({
      queue_name: params.name,
      pending_jobs: 10,
      processing_jobs: 2,
      completed_jobs_24h: 100,
      failed_jobs_24h: 5,
      deadletter_jobs: 3,
      avg_processing_time_ms: 1200,
      max_job_age_seconds: 300,
      active_workers: 2,
    });
  }),

  // Workers - return backend format (API transforms to frontend format)
  http.get(`${API_BASE}/api/v1/workers`, () => {
    // Return WorkerSummary[] format
    return HttpResponse.json(mockWorkersSummary);
  }),

  http.get(`${API_BASE}/api/v1/workers/:id`, ({ params }) => {
    const id = params.id as string;
    const worker = mockWorkerDetails[id];
    if (!worker) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Worker not found' }, { status: 404 });
    }
    // Return full Worker format
    return HttpResponse.json(worker);
  }),

  // Worker deregister - POST to /workers/:id/deregister
  http.post(`${API_BASE}/api/v1/workers/:id/deregister`, ({ params }) => {
    const id = params.id as string;
    const worker = mockWorkerDetails[id];
    if (!worker) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Worker not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Schedules
  http.get(`${API_BASE}/api/v1/schedules`, () => {
    return HttpResponse.json(
      mockSchedules.map((s) => ({
        id: s.id,
        organization_id: s.organization_id,
        name: s.name,
        description: s.description ?? null,
        cron_expression: s.cron_expression,
        timezone: s.timezone,
        queue_name: s.queue,
        payload_template: { ...(s.payload as Record<string, unknown>), job_type: s.job_type },
        priority: 0,
        max_retries: 3,
        timeout_seconds: 300,
        is_active: s.enabled,
        last_run_at: (s as { last_run?: string }).last_run ?? null,
        next_run_at: (s as { next_run?: string }).next_run ?? null,
        run_count: 0,
        tags: null,
        metadata: (s as { metadata?: Record<string, string> }).metadata ?? null,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }))
    );
  }),

  http.get(`${API_BASE}/api/v1/schedules/:id`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: schedule.id,
      organization_id: schedule.organization_id,
      name: schedule.name,
      description: schedule.description ?? null,
      cron_expression: schedule.cron_expression,
      timezone: schedule.timezone,
      queue_name: schedule.queue,
      payload_template: {
        ...(schedule.payload as Record<string, unknown>),
        job_type: schedule.job_type,
      },
      priority: 0,
      max_retries: 3,
      timeout_seconds: 300,
      is_active: schedule.enabled,
      last_run_at: (schedule as { last_run?: string }).last_run ?? null,
      next_run_at: (schedule as { next_run?: string }).next_run ?? null,
      run_count: 0,
      tags: null,
      metadata: (schedule as { metadata?: Record<string, string> }).metadata ?? null,
      created_at: schedule.created_at,
      updated_at: schedule.updated_at,
    });
  }),

  http.post(`${API_BASE}/api/v1/schedules`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const id = `schedule-${Date.now()}`;
    const name = (body.name as string) || 'New Schedule';
    const cron_expression = (body.cron_expression as string) || '* * * * *';
    const queue_name = (body.queue_name as string) || 'default';
    const payload_template = (body.payload_template as Record<string, unknown>) || {};
    const job_type =
      typeof (payload_template as { job_type?: unknown }).job_type === 'string'
        ? ((payload_template as { job_type?: string }).job_type as string)
        : 'job';

    // Persist into frontend mock array so follow-up GET succeeds
    mockSchedules.push({
      id,
      organization_id: 'org-1',
      name,
      description: (body.description as string) || '',
      cron_expression,
      timezone: (body.timezone as string) || 'UTC',
      queue: queue_name,
      job_type,
      payload: payload_template,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return HttpResponse.json(
      {
        id,
        name,
        cron_expression,
        next_run_at: new Date(Date.now() + 60_000).toISOString(),
      },
      { status: 201 }
    );
  }),

  http.get(`${API_BASE}/api/v1/schedules/:id/history`, () => {
    return HttpResponse.json([]);
  }),

  http.put(`${API_BASE}/api/v1/schedules/:id`, async ({ params, request }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: schedule.id,
      organization_id: schedule.organization_id,
      name: (body.name as string) ?? schedule.name,
      description: (body.description as string) ?? schedule.description ?? null,
      cron_expression: (body.cron_expression as string) ?? schedule.cron_expression,
      timezone: (body.timezone as string) ?? schedule.timezone,
      queue_name: (body.queue_name as string) ?? schedule.queue,
      payload_template: (body.payload_template as Record<string, unknown>) ?? {
        ...(schedule.payload as Record<string, unknown>),
        job_type: schedule.job_type,
      },
      priority: 0,
      max_retries: 3,
      timeout_seconds: 300,
      is_active: true,
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      tags: null,
      metadata: (body.metadata as Record<string, unknown>) ?? null,
      created_at: schedule.created_at,
      updated_at: new Date().toISOString(),
    });
  }),

  http.delete(`${API_BASE}/api/v1/schedules/:id`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE}/api/v1/schedules/:id/trigger`, ({ params }) => {
    return HttpResponse.json({ job_id: `triggered-job-${params.id}` });
  }),

  http.post(`${API_BASE}/api/v1/schedules/:id/pause`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: schedule.id,
      organization_id: schedule.organization_id,
      name: schedule.name,
      description: schedule.description ?? null,
      cron_expression: schedule.cron_expression,
      timezone: schedule.timezone,
      queue_name: schedule.queue,
      payload_template: {
        ...(schedule.payload as Record<string, unknown>),
        job_type: schedule.job_type,
      },
      priority: 0,
      max_retries: 3,
      timeout_seconds: 300,
      is_active: false,
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      tags: null,
      metadata: null,
      created_at: schedule.created_at,
      updated_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/api/v1/schedules/:id/resume`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: schedule.id,
      organization_id: schedule.organization_id,
      name: schedule.name,
      description: schedule.description ?? null,
      cron_expression: schedule.cron_expression,
      timezone: schedule.timezone,
      queue_name: schedule.queue,
      payload_template: {
        ...(schedule.payload as Record<string, unknown>),
        job_type: schedule.job_type,
      },
      priority: 0,
      max_retries: 3,
      timeout_seconds: 300,
      is_active: true,
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      tags: null,
      metadata: null,
      created_at: schedule.created_at,
      updated_at: new Date().toISOString(),
    });
  }),

  // Workflows
  http.get(`${API_BASE}/api/v1/workflows`, () => {
    // The list returns WorkflowResponse summaries (counts, no jobs array)
    return HttpResponse.json(
      mockWorkflows.map((w) => {
        const total = w.jobs.length;
        const completed = w.jobs.filter((j) => j.status === 'completed').length;
        return {
          id: w.id,
          name: w.name,
          description: w.description,
          status: w.status,
          total_jobs: total,
          completed_jobs: completed,
          failed_jobs: w.jobs.filter((j) => j.status === 'failed').length,
          progress_percent: total === 0 ? 0 : (completed / total) * 100,
          created_at: w.created_at,
          started_at: w.created_at,
          completed_at: w.completed_at,
          metadata: null,
        };
      })
    );
  }),

  http.post(`${API_BASE}/api/v1/workflows`, async ({ request }) => {
    const body = (await request.json()) as {
      name?: string;
      jobs?: Array<{ key: string }>;
    };
    const jobs = Array.isArray(body.jobs) ? body.jobs : [];
    return HttpResponse.json(
      {
        workflow_id: `workflow-${Date.now()}`,
        job_ids: jobs.map((job, index) => ({
          key: job.key,
          job_id: `job-wf-${index + 1}`,
        })),
        status: 'pending',
      },
      { status: 201 }
    );
  }),

  http.get(`${API_BASE}/api/v1/workflows/:id`, ({ params }) => {
    const workflow = mockWorkflows.find((w) => w.id === params.id);
    if (!workflow) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Workflow not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      ...workflow,
      progress: {
        total: workflow.jobs.length,
        completed: workflow.jobs.filter((j) => j.status === 'completed').length,
        failed: workflow.jobs.filter((j) => j.status === 'failed').length,
        pending: workflow.jobs.filter((j) => j.status === 'pending').length,
        processing: workflow.jobs.filter((j) => j.status === 'processing').length,
      },
    });
  }),

  // API Keys
  http.get(`${API_BASE}/api/v1/api-keys`, () => {
    return HttpResponse.json(mockApiKeys);
  }),

  http.post(`${API_BASE}/api/v1/api-keys`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        id: `key-${Date.now()}`,
        name: (body.name as string) || 'New API Key',
        key: 'sp_test_xxxxxxxxxxxxxxxxxxxx', // Full key only shown once
        created_at: now,
        expires_at: (body.expires_at as string) || null,
      },
      { status: 201 }
    );
  }),

  http.put(`${API_BASE}/api/v1/api-keys/:id`, async ({ params, request }) => {
    const key = mockApiKeys.find((k) => k.id === params.id);
    if (!key) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `API key ${String(params.id)} not found` },
        { status: 404 }
      );
    }
    // ApiKeySummary after the merge: omitted fields keep the key's value
    const body = (await request.json()) as { name?: string; is_active?: boolean };
    return HttpResponse.json({
      ...key,
      name: body.name ?? key.name,
      is_active: body.is_active ?? key.is_active,
    });
  }),

  http.delete(`${API_BASE}/api/v1/api-keys/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Outgoing Webhooks
  http.get(`${API_BASE}/api/v1/outgoing-webhooks`, () => {
    return HttpResponse.json(mockWebhooks);
  }),

  http.post(`${API_BASE}/api/v1/outgoing-webhooks`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newWebhook = {
      id: `webhook-${Date.now()}`,
      organization_id: 'org-1',
      failure_count: 0,
      // an omitted format is stored as "json"
      format: 'json',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(newWebhook, { status: 201 });
  }),

  http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/test`, () => {
    return HttpResponse.json({
      success: true,
      status_code: 200,
      response_time_ms: 150,
    });
  }),

  http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id`, ({ params }) => {
    const webhook = mockWebhooks.find((w) => w.id === params.id);
    if (!webhook) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json(webhook);
  }),

  http.put(`${API_BASE}/api/v1/outgoing-webhooks/:id`, async ({ params, request }) => {
    const webhook = mockWebhooks.find((w) => w.id === params.id);
    if (!webhook) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...webhook, ...body, updated_at: new Date().toISOString() });
  }),

  http.delete(`${API_BASE}/api/v1/outgoing-webhooks/:id`, ({ params }) => {
    const webhook = mockWebhooks.find((w) => w.id === params.id);
    if (!webhook) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Webhook not found' },
        { status: 404 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id/deliveries`, () => {
    return HttpResponse.json([
      {
        id: 'delivery-1',
        webhook_id: 'webhook-1',
        event: 'job.completed',
        payload: { job_id: 'job-1' },
        status: 'success',
        status_code: 200,
        response_body: null,
        error: null,
        attempts: 1,
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
      },
      {
        id: 'delivery-2',
        webhook_id: 'webhook-1',
        event: 'job.failed',
        payload: { job_id: 'job-3' },
        status: 'failed',
        status_code: 500,
        response_body: null,
        error: 'HTTP 500',
        attempts: 3,
        created_at: new Date().toISOString(),
        delivered_at: null,
      },
    ]);
  }),

  // POST /outgoing-webhooks/{id}/retry/{delivery_id}: 200 even when the endpoint still refuses
  http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/retry/:deliveryId`, ({ params }) => {
    if (params.deliveryId === 'delivery-1') {
      return HttpResponse.json(
        { code: 'BAD_REQUEST', message: 'Cannot retry a successful delivery' },
        { status: 400 }
      );
    }
    return HttpResponse.json({ success: true, message: 'Delivery retried successfully' });
  }),

  // GET /webhooks/deliveries: the inbound webhook log (backend 0.1.122), newest first
  http.get(`${API_BASE}/api/v1/webhooks/deliveries`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status')?.toLowerCase();
    const since = url.searchParams.get('since');
    const queue = url.searchParams.get('queue_name') ?? url.searchParams.get('queue');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '50'), 1), 100);
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0);
    if (status && status !== 'created' && status !== 'duplicate') {
      return HttpResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: `Invalid status '${status}': expected created or duplicate`,
        },
        { status: 400 }
      );
    }
    let rows = [...mockInboundDeliveries];
    if (status) rows = rows.filter((r) => r.status === status);
    if (since) rows = rows.filter((r) => Date.parse(r.created_at) >= Date.parse(since));
    if (queue) rows = rows.filter((r) => r.matched_queue === queue);
    return HttpResponse.json(rows.slice(offset, offset + limit));
  }),

  // Auth logout
  http.post(`${API_BASE}/api/v1/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Billing
  http.get(`${API_BASE}/api/v1/billing/status`, () => {
    return HttpResponse.json(mockBillingStatusFree);
  }),

  http.post(`${API_BASE}/api/v1/billing/portal`, async () => {
    return HttpResponse.json({ url: 'https://billing.stripe.com/session/test' });
  }),

  // Organizations
  http.post(`${API_BASE}/api/v1/organizations/billing-email/verification`, () => {
    return HttpResponse.json({ status: 'code_sent', email_sent_to: 'o***r@example.com' });
  }),

  http.post(`${API_BASE}/api/v1/organizations/billing-email/verify`, async ({ request }) => {
    const body = (await request.json()) as { code?: string };
    // The backend answers a wrong or expired code with 400, not 401: the API client treats
    // a 401 as an expired session and would try to refresh the token.
    if (body.code !== '123456') {
      return HttpResponse.json(
        { code: 'BAD_REQUEST', message: 'Invalid or expired code' },
        { status: 400 }
      );
    }
    return HttpResponse.json({ status: 'verified' });
  }),

  // Before /organizations/:id, which would otherwise answer "usage" with the organization
  http.get(`${API_BASE}/api/v1/organizations/usage`, () => {
    return HttpResponse.json(mockUsage);
  }),

  http.get(`${API_BASE}/api/v1/organizations/:id`, ({ params }) => {
    if (params.id === mockOrganizationPendingBillingEmail.id) {
      return HttpResponse.json(mockOrganizationPendingBillingEmail);
    }
    return HttpResponse.json(mockOrganization);
  }),

  // DELETE /organizations/{id}: 204 for the caller's own organization
  http.delete(`${API_BASE}/api/v1/organizations/:id`, ({ params }) => {
    if (params.id !== mockOrganization.id) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Resource not found' },
        { status: 404 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.put(`${API_BASE}/api/v1/organizations/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    // A changed billing email is not applied: the verified address stays and the new one
    // waits as pending_billing_email until its code is confirmed.
    const changedBillingEmail =
      typeof body.billing_email === 'string' &&
      body.billing_email !== mockOrganization.billing_email
        ? body.billing_email
        : null;
    return HttpResponse.json({
      ...mockOrganization,
      name: (body.name as string) ?? mockOrganization.name,
      settings: (body.settings as Record<string, unknown>) ?? {},
      pending_billing_email: changedBillingEmail,
    });
  }),

  // "Members" are the org's active API keys (there are no user accounts): id == user_id ==
  // key id, every row carries the organization's billing email, role is owner for "*" keys.
  http.get(`${API_BASE}/api/v1/organizations/:id/members`, () => {
    return HttpResponse.json([
      {
        id: 'key-1',
        user_id: 'key-1',
        email: 'billing@example.com',
        name: 'Production key',
        role: 'owner',
        joined_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'key-2',
        user_id: 'key-2',
        email: 'billing@example.com',
        name: 'Emails worker',
        role: 'member',
        joined_at: '2024-01-02T00:00:00Z',
      },
    ]);
  }),

  // Runtime config endpoint
  http.get('/api/config', () => {
    return HttpResponse.json({
      apiUrl: 'https://api.spooled.cloud',
      wsUrl: 'wss://api.spooled.cloud',
      sentryEnvironment: 'test',
      enableWorkflows: true,
      enableSchedules: true,
      enableAnalytics: false,
      version: '0.1.60',
      commit: 'abc123def',
      environment: 'test',
    });
  }),
];
