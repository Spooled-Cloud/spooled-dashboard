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
});
