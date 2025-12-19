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
  plan: 'professional',
  status: 'active',
  member_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
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
  },
  {
    id: 'worker-2',
    queue_name: 'default',
    hostname: 'worker-node-2',
    status: 'healthy',
    current_jobs: 0,
    max_concurrency: 5,
    last_heartbeat: new Date().toISOString(),
  },
];

// Backend format for worker detail (Worker)
export const mockWorkerDetails: Record<
  string,
  {
    id: string;
    organization_id: string;
    queue_name: string;
    queue_names: string[];
    hostname: string;
    worker_type: string | null;
    max_concurrent_jobs: number;
    current_job_count: number;
    status: string;
    last_heartbeat: string;
    metadata: Record<string, unknown>;
    version: string | null;
    created_at: string;
    updated_at: string;
  }
> = {
  'worker-1': {
    id: 'worker-1',
    organization_id: 'org-1',
    queue_name: 'default',
    queue_names: ['default', 'emails'],
    hostname: 'worker-node-1',
    worker_type: 'http',
    max_concurrent_jobs: 10,
    current_job_count: 3,
    status: 'healthy',
    last_heartbeat: new Date().toISOString(),
    metadata: {},
    version: '1.0.0',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  },
  'worker-2': {
    id: 'worker-2',
    organization_id: 'org-1',
    queue_name: 'default',
    queue_names: ['default'],
    hostname: 'worker-node-2',
    worker_type: 'http',
    max_concurrent_jobs: 5,
    current_job_count: 0,
    status: 'healthy',
    last_heartbeat: new Date().toISOString(),
    metadata: {},
    version: '1.0.0',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
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
    jobs_processed: 150,
    jobs_failed: 5,
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
    jobs_processed: 80,
    jobs_failed: 2,
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
    rate_limit: null,
    is_active: true,
    expires_at: null,
    created_at: '2024-01-01T00:00:00Z',
    last_used: '2024-01-01T12:00:00Z',
  },
];

export const mockWebhooks = [
  {
    id: 'webhook-1',
    organization_id: 'org-1',
    name: 'Slack Notifications',
    url: 'https://hooks.slack.com/services/xxx',
    events: ['job.completed', 'job.failed'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    failure_count: 0,
  },
];

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
    return HttpResponse.json({
      access_token: 'email-access-token',
      refresh_token: 'email-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_expires_in: 2592000,
      user_id: 'usr_test',
      email: 'test@example.com',
      organizations: [{ id: 'org-1', role: 'owner' }],
    });
  }),

  http.post(`${API_BASE}/api/v1/auth/refresh`, () => {
    return HttpResponse.json({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }),

  http.get(`${API_BASE}/api/v1/auth/me`, () => {
    return HttpResponse.json(mockUser);
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
      processing: 10,
      completed: 900,
      failed: 30,
      cancelled: 5,
      deadletter: 5,
      success_rate: 96.8,
      avg_processing_time_ms: 1500,
    });
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
        updated_at: job?.created_at || new Date().toISOString(),
      };
    });
    return HttpResponse.json(statuses);
  }),

  http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const queueName = url.searchParams.get('queue_name');
    const limit = Number(url.searchParams.get('limit') || '50');
    const offset = Number(url.searchParams.get('offset') || '0');

    let filtered = [...mockJobs];
    if (status) {
      filtered = filtered.filter((j) => j.status === status);
    }
    if (queueName) {
      filtered = filtered.filter((j) => j.queue === queueName);
    }

    // Backend returns JobSummary[] (not paginated object)
    const summaries = filtered.map((j) => ({
      id: j.id,
      queue_name: j.queue,
      status: j.status,
      priority: j.priority,
      attempt: j.attempt,
      max_retries: j.max_retries,
      created_at: j.created_at,
      scheduled_at: (j as { scheduled_at?: string }).scheduled_at ?? null,
      started_at: (j as { started_at?: string }).started_at ?? null,
      completed_at: (j as { completed_at?: string }).completed_at ?? null,
    }));

    return HttpResponse.json(summaries.slice(offset, offset + limit));
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
      payload_template: { ...(schedule.payload as Record<string, unknown>), job_type: schedule.job_type },
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
      payload_template:
        (body.payload_template as Record<string, unknown>) ??
        { ...(schedule.payload as Record<string, unknown>), job_type: schedule.job_type },
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
      payload_template: { ...(schedule.payload as Record<string, unknown>), job_type: schedule.job_type },
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
      payload_template: { ...(schedule.payload as Record<string, unknown>), job_type: schedule.job_type },
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
    return HttpResponse.json(mockWorkflows);
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
        event_type: 'job.completed',
        status: 'success',
        status_code: 200,
        response_time_ms: 120,
        delivered_at: new Date().toISOString(),
      },
    ]);
  }),

  // Auth logout
  http.post(`${API_BASE}/api/v1/auth/logout`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Organizations
  http.get(`${API_BASE}/api/v1/organizations/:id`, () => {
    return HttpResponse.json(mockOrganization);
  }),

  http.get(`${API_BASE}/api/v1/organizations/:id/members`, () => {
    return HttpResponse.json([
      {
        id: 'member-1',
        user_id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'owner',
        joined_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'member-2',
        user_id: 'user-2',
        email: 'developer@example.com',
        name: 'Developer',
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
      enableQueuePurge: false,
    });
  }),
];
