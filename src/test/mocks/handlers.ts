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
  system_info: {
    version: '1.0.0',
    uptime_seconds: 86400,
    rust_version: '1.75.0',
  },
  job_statistics: {
    total: 1000,
    pending: 50,
    processing: 10,
    completed: 900,
    failed: 30,
    cancelled: 5,
    deadletter: 5,
    success_rate: 96.8,
    avg_processing_time_ms: 1500,
  },
  queue_summaries: [
    { name: 'default', pending: 30, processing: 5, completed: 500, failed: 10, paused: false },
    { name: 'emails', pending: 20, processing: 5, completed: 400, failed: 20, paused: false },
  ],
  worker_status: {
    total: 2,
    active: 1,
    idle: 1,
    offline: 0,
  },
  recent_activity: [
    {
      type: 'job.completed',
      job_id: 'job-1',
      queue: 'default',
      timestamp: new Date().toISOString(),
    },
    { type: 'job.started', job_id: 'job-2', queue: 'default', timestamp: new Date().toISOString() },
  ],
  processing_rate: [{ timestamp: new Date().toISOString(), jobs_per_second: 5.2 }],
};

export const mockApiKeys = [
  {
    id: 'key-1',
    organization_id: 'org-1',
    name: 'Production API Key',
    key_prefix: 'sp_prod_',
    permissions: ['jobs:read', 'jobs:write'],
    created_at: '2024-01-01T00:00:00Z',
    last_used_at: '2024-01-01T12:00:00Z',
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

  http.get(`${API_BASE}/api/v1/jobs/status`, () => {
    return HttpResponse.json({
      pending: 50,
      scheduled: 10,
      processing: 10,
      completed: 900,
      failed: 30,
      cancelled: 5,
      deadletter: 5,
    });
  }),

  http.get(`${API_BASE}/api/v1/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const queue = url.searchParams.get('queue');

    let filtered = [...mockJobs];
    if (status) {
      filtered = filtered.filter((j) => j.status === status);
    }
    if (queue) {
      filtered = filtered.filter((j) => j.queue === queue);
    }

    return HttpResponse.json({
      data: filtered,
      total: filtered.length,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });
  }),

  http.get(`${API_BASE}/api/v1/jobs/:id`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    return HttpResponse.json(job);
  }),

  http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newJob = {
      id: `job-${Date.now()}`,
      organization_id: 'org-1',
      ...body,
      status: 'pending',
      attempt: 0,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newJob, { status: 201 });
  }),

  http.post(`${API_BASE}/api/v1/jobs/:id/retry`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    return HttpResponse.json({ ...job, status: 'pending', attempt: 0 });
  }),

  http.post(`${API_BASE}/api/v1/jobs/:id/cancel`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    return HttpResponse.json({ ...job, status: 'cancelled' });
  }),

  http.delete(`${API_BASE}/api/v1/jobs/:id`, ({ params }) => {
    const job = mockJobs.find((j) => j.id === params.id);
    if (!job) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Job not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Queues
  http.get(`${API_BASE}/api/v1/queues`, () => {
    return HttpResponse.json(mockQueues);
  }),

  http.get(`${API_BASE}/api/v1/queues/:name`, ({ params }) => {
    const queue = mockQueues.find((q) => q.name === params.name);
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    return HttpResponse.json(queue);
  }),

  http.post(`${API_BASE}/api/v1/queues`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newQueue = {
      organization_id: 'org-1',
      concurrency: 10,
      max_retries: 3,
      retry_delay_ms: 1000,
      backoff_multiplier: 2,
      max_retry_delay_ms: 60000,
      job_timeout_ms: 30000,
      paused: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(newQueue, { status: 201 });
  }),

  http.put(`${API_BASE}/api/v1/queues/:name`, async ({ params, request }) => {
    const queue = mockQueues.find((q) => q.name === params.name);
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...queue, ...body, updated_at: new Date().toISOString() });
  }),

  http.post(`${API_BASE}/api/v1/queues/:name/pause`, ({ params }) => {
    const queue = mockQueues.find((q) => q.name === params.name);
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    return HttpResponse.json({ ...queue, paused: true });
  }),

  http.post(`${API_BASE}/api/v1/queues/:name/resume`, ({ params }) => {
    const queue = mockQueues.find((q) => q.name === params.name);
    if (!queue) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Queue not found' }, { status: 404 });
    }
    return HttpResponse.json({ ...queue, paused: false });
  }),

  http.delete(`${API_BASE}/api/v1/queues/:name`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API_BASE}/api/v1/queues/:name/purge`, () => {
    return HttpResponse.json({ deleted: 15 });
  }),

  http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) => {
    return HttpResponse.json({
      name: params.name,
      pending: 10,
      processing: 2,
      completed: 100,
      failed: 5,
      deadletter: 1,
      active_workers: 2,
      jobs_per_second: 3.5,
      avg_processing_time_ms: 1200,
    });
  }),

  // Workers
  http.get(`${API_BASE}/api/v1/workers`, () => {
    return HttpResponse.json(mockWorkers);
  }),

  http.get(`${API_BASE}/api/v1/workers/:id`, ({ params }) => {
    const worker = mockWorkers.find((w) => w.id === params.id);
    if (!worker) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Worker not found' }, { status: 404 });
    }
    return HttpResponse.json(worker);
  }),

  http.delete(`${API_BASE}/api/v1/workers/:id`, ({ params }) => {
    const worker = mockWorkers.find((w) => w.id === params.id);
    if (!worker) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Worker not found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Schedules
  http.get(`${API_BASE}/api/v1/schedules`, () => {
    return HttpResponse.json(mockSchedules);
  }),

  http.get(`${API_BASE}/api/v1/schedules/:id`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json(schedule);
  }),

  http.post(`${API_BASE}/api/v1/schedules`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newSchedule = {
      id: `schedule-${Date.now()}`,
      organization_id: 'org-1',
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(newSchedule, { status: 201 });
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
    return HttpResponse.json({ ...schedule, ...body, updated_at: new Date().toISOString() });
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
    return HttpResponse.json({ ...schedule, enabled: false });
  }),

  http.post(`${API_BASE}/api/v1/schedules/:id/resume`, ({ params }) => {
    const schedule = mockSchedules.find((s) => s.id === params.id);
    if (!schedule) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Schedule not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ ...schedule, enabled: true });
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
    const newKey = {
      id: `key-${Date.now()}`,
      organization_id: 'org-1',
      key_prefix: 'sp_test_',
      created_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(
      {
        ...newKey,
        key: 'sp_test_xxxxxxxxxxxxxxxxxxxx', // Full key only shown once
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
];
