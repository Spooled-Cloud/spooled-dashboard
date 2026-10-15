/**
 * The MSW handlers must keep the response shapes of the real backend, otherwise tests
 * stay green while production differs. Each case mirrors a handler in spooled-backend.
 */
import { describe, it, expect } from 'vitest';
import { apiClient, APIError } from '@/lib/api/client';
import { loginTokensFromEmailVerify } from '@/components/auth/LoginPage';

describe('mock backend contract', () => {
  it('DELETE /jobs/:id cancels a pending job (204)', async () => {
    await expect(apiClient.delete('/api/v1/jobs/job-2')).resolves.toBeUndefined();
  });

  it('DELETE /jobs/:id answers 409 for a terminal job', async () => {
    const error = await apiClient.delete('/api/v1/jobs/job-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe(409);
  });

  it('auth/refresh returns no refresh_token', async () => {
    const res = await apiClient.post<Record<string, unknown>>(
      '/api/v1/auth/refresh',
      { refresh_token: 'x' },
      { skipAuth: true }
    );
    expect(res).toHaveProperty('access_token');
    expect(res).not.toHaveProperty('refresh_token');
  });

  it('auth/email/verify carries the type discriminator', async () => {
    const res = await apiClient.post<Record<string, unknown>>(
      '/api/v1/auth/email/verify',
      { email: 'a@b.test', code: '123456' },
      { skipAuth: true }
    );
    expect(res.type).toBe('login');
    expect(loginTokensFromEmailVerify(res as never)).toMatchObject({
      access_token: 'email-access-token',
    });
  });

  it('outgoing webhook deliveries use event/attempts/created_at', async () => {
    const rows = await apiClient.get<Array<Record<string, unknown>>>(
      '/api/v1/outgoing-webhooks/webhook-1/deliveries'
    );
    expect(rows[0]).toMatchObject({ event: 'job.completed', attempts: 1 });
    expect(rows[0]).not.toHaveProperty('event_type');
    expect(rows[0]).not.toHaveProperty('response_time_ms');
  });

  it('organization has plan_tier and settings', async () => {
    const org = await apiClient.get<Record<string, unknown>>('/api/v1/organizations/org-1');
    expect(org.plan_tier).toBe('pro');
    expect(org.settings).toEqual({});
  });

  it('members are API keys (id equals user_id, shared billing email)', async () => {
    const members = await apiClient.get<Array<Record<string, string>>>(
      '/api/v1/organizations/org-1/members'
    );
    for (const m of members) {
      expect(m.user_id).toBe(m.id);
    }
    expect(new Set(members.map((m) => m.email)).size).toBe(1);
  });

  it('billing-email verify answers 400 (not 401) for a wrong or expired code', async () => {
    const error = await apiClient
      .post('/api/v1/organizations/billing-email/verify', { code: '000000' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe(400);
    expect((error as APIError).message).toBe('Invalid or expired code');
  });

  it('billing-email verify accepts the right code', async () => {
    await expect(
      apiClient.post('/api/v1/organizations/billing-email/verify', { code: '123456' })
    ).resolves.toEqual({ status: 'verified' });
  });

  it('queue stats carry the dead-letter count', async () => {
    const stats = await apiClient.get<Record<string, unknown>>('/api/v1/queues/default/stats');
    expect(stats.deadletter_jobs).toBe(3);
  });

  it('GET /organizations/:id can return a pending billing email', async () => {
    const plain = await apiClient.get<Record<string, unknown>>('/api/v1/organizations/org-1');
    expect(plain.pending_billing_email).toBeNull();
    const pending = await apiClient.get<Record<string, unknown>>(
      '/api/v1/organizations/org-pending'
    );
    expect(pending.pending_billing_email).toBe('new-billing@example.com');
    expect(pending.billing_email).toBe('billing@example.com');
    expect(pending.billing_email_verified_at).not.toBeNull();
  });

  it('PUT /organizations/:id keeps the verified billing email and returns the new one as pending', async () => {
    const updated = await apiClient.put<Record<string, unknown>>('/api/v1/organizations/org-1', {
      billing_email: 'other@example.com',
    });
    expect(updated.billing_email).toBe('billing@example.com');
    expect(updated.pending_billing_email).toBe('other@example.com');
  });

  it('workflows list returns summaries without a jobs array', async () => {
    const list = await apiClient.get<Array<Record<string, unknown>>>('/api/v1/workflows');
    expect(list[0]).toMatchObject({ total_jobs: 2, completed_jobs: expect.any(Number) });
    expect(list[0]).not.toHaveProperty('jobs');
  });

  it('GET /jobs takes a status list, q, job_type, tag and a created window, and sends X-Has-More', async () => {
    const { data, headers } = await apiClient.getWithHeaders<Array<Record<string, string>>>(
      '/api/v1/jobs',
      { status: 'completed,pending', limit: 2, offset: 0 }
    );
    expect(data.map((j) => j.id)).toEqual(['job-1', 'job-2']);
    // job-4 (pending) matches too and follows this page
    expect(headers.get('x-has-more')).toBe('true');

    const first = await apiClient.getWithHeaders('/api/v1/jobs', { limit: 1 });
    expect(first.headers.get('x-has-more')).toBe('true');

    const byWindow = await apiClient.get<Array<Record<string, string>>>('/api/v1/jobs', {
      created_after: '2024-01-01T00:02:00Z',
      created_before: '2024-01-01T00:04:00Z',
    });
    expect(byWindow.map((j) => j.id)).toEqual(['job-2', 'job-3']);
  });

  it('GET /jobs answers 400 naming an unknown status entry', async () => {
    const error = await apiClient
      .get('/api/v1/jobs', { status: 'pending,bogus' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(APIError);
    expect((error as APIError).status).toBe(400);
    expect((error as APIError).message).toContain("'bogus'");
  });

  it('GET /jobs/{id}/history returns job_history rows and 404 for an unknown job', async () => {
    const rows = await apiClient.get<Array<Record<string, unknown>>>('/api/v1/jobs/job-1/history');
    expect(rows[0]).toMatchObject({
      id: 'hist-1',
      job_id: 'job-1',
      event_type: 'processing',
      worker_id: 'worker-1',
    });
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['created_at', 'details', 'event_type', 'id', 'job_id', 'worker_id'].sort()
    );

    const desc = await apiClient.get<Array<{ id: string }>>('/api/v1/jobs/job-1/history', {
      order_dir: 'desc',
    });
    expect(desc[0].id).toBe('hist-4');

    const error = await apiClient.get('/api/v1/jobs/nope/history').catch((e: unknown) => e);
    expect((error as APIError).status).toBe(404);
  });

  it('GET /schedules/{id}/history reports pending|running|completed|failed with job_status (backend 0.1.125)', async () => {
    const rows = await apiClient.get<Array<Record<string, unknown>>>(
      '/api/v1/schedules/schedule-1/history'
    );
    expect(rows.map((r) => r.status)).toEqual([
      'pending',
      'running',
      'completed',
      'failed',
      'failed',
    ]);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'completed_at',
          'error_message',
          'id',
          'job_id',
          'job_status',
          'schedule_id',
          'started_at',
          'status',
        ].sort()
      );
    }
    // A run counts as finished only once its job did: in-flight runs have no completed_at
    expect(rows.filter((r) => r.completed_at === null).map((r) => r.job_status)).toEqual([
      'pending',
      'processing',
    ]);
    // No job, no job_status
    expect(rows[4]).toMatchObject({ job_id: null, job_status: null });

    await expect(apiClient.get('/api/v1/schedules/unknown/history')).resolves.toEqual([]);
  });

  it('workers carry jobs_processed and jobs_failed (backend 0.1.122)', async () => {
    const list = await apiClient.get<Array<Record<string, unknown>>>('/api/v1/workers');
    const detail = await apiClient.get<Record<string, unknown>>('/api/v1/workers/worker-1');
    for (const worker of [list[0], detail]) {
      expect(typeof worker.jobs_processed).toBe('number');
      expect(typeof worker.jobs_failed).toBe('number');
    }
  });

  it('outgoing webhooks carry format; create defaults it to json', async () => {
    const list = await apiClient.get<Array<Record<string, unknown>>>('/api/v1/outgoing-webhooks');
    expect(list[0].format).toBe('slack');

    const created = await apiClient.post<Record<string, unknown>>('/api/v1/outgoing-webhooks', {
      name: 'n',
      url: 'https://example.com',
      events: ['job.deadlettered'],
    });
    expect(created.format).toBe('json');
  });

  it('POST /outgoing-webhooks/{id}/retry/{delivery_id}: 200 {success, message}, 400 for a delivered one', async () => {
    const ok = await apiClient.post<Record<string, unknown>>(
      '/api/v1/outgoing-webhooks/webhook-1/retry/delivery-2'
    );
    expect(ok).toEqual({ success: true, message: 'Delivery retried successfully' });

    const error = await apiClient
      .post('/api/v1/outgoing-webhooks/webhook-1/retry/delivery-1')
      .catch((e: unknown) => e);
    expect((error as APIError).status).toBe(400);
  });

  it('GET /webhooks/deliveries is the inbound log: summaries without payload, newest first', async () => {
    const rows = await apiClient.get<Array<Record<string, unknown>>>('/api/v1/webhooks/deliveries');
    expect(rows.map((r) => r.id)).toEqual(['inbound-3', 'inbound-2', 'inbound-1']);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        ['created_at', 'event_type', 'id', 'job_id', 'matched_queue', 'provider', 'status'].sort()
      );
      expect(row).not.toHaveProperty('payload');
      expect(row).not.toHaveProperty('signature');
    }
    // entries from before 0.1.122 have no job and no outcome
    expect(rows[2]).toMatchObject({ job_id: null, status: null });
  });

  it('GET /webhooks/deliveries answers 400 for an unknown status', async () => {
    const error = await apiClient
      .get('/api/v1/webhooks/deliveries', { status: 'weird' })
      .catch((e: unknown) => e);
    expect((error as APIError).status).toBe(400);
  });

  it('PUT /api-keys/{id} merges name and is_active into the key', async () => {
    const key = await apiClient.put<Record<string, unknown>>('/api/v1/api-keys/key-1', {
      name: 'x',
    });
    expect(key).toMatchObject({ id: 'key-1', name: 'x', is_active: true });
  });

  it('DELETE /organizations/{id} is 204 for the caller and 404 for another organization', async () => {
    await expect(apiClient.delete('/api/v1/organizations/org-1')).resolves.toBeUndefined();
    const error = await apiClient.delete('/api/v1/organizations/other').catch((e: unknown) => e);
    expect((error as APIError).status).toBe(404);
  });

  it('GET /organizations/usage is the plan usage, not the organization', async () => {
    const usage = await apiClient.get<Record<string, unknown>>('/api/v1/organizations/usage');
    expect(usage).toHaveProperty('limits');
    expect(usage).toHaveProperty('usage');
    expect(usage).not.toHaveProperty('slug');
  });
});
