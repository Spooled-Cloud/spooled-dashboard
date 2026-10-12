import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { setAdminKey } from '@/lib/api/admin';
import { AdminOrganizationDetail } from './AdminOrganizationDetail';

const API_BASE = 'https://api.spooled.cloud';

const limits = {
  tier: 'free',
  display_name: 'Free',
  max_jobs_per_day: 1000,
  max_active_jobs: 10,
  max_queues: 5,
  max_workers: 2,
  max_api_keys: 2,
  max_schedules: 2,
  max_workflows: 2,
  max_webhooks: 2,
  max_payload_size_bytes: 65536,
  rate_limit_requests_per_second: 5,
  rate_limit_burst: 10,
  job_retention_days: 7,
  history_retention_days: 7,
};
const item = { current: 0, limit: 5, percentage: 0, is_disabled: false };

const org = {
  id: 'org-9',
  name: 'Acme',
  slug: 'acme',
  plan_tier: 'free',
  billing_email: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  usage: { jobs_today: 0, active_jobs: 0, queues: 0, workers: 0, api_keys: 0 },
  settings: {},
  custom_limits: { max_workers: 5, job_retention_days: 30 },
  stripe_customer_id: null,
  stripe_subscription_id: null,
  stripe_subscription_status: null,
  stripe_current_period_end: null,
  stripe_cancel_at_period_end: null,
  usage_info: {
    plan: 'free',
    plan_display_name: 'Free',
    limits,
    usage: {
      jobs_today: item,
      active_jobs: item,
      queues: item,
      workers: item,
      api_keys: item,
      schedules: item,
      workflows: item,
      webhooks: item,
    },
    warnings: [],
  },
  api_keys_count: 1,
  total_jobs: 0,
};

describe('AdminOrganizationDetail custom limits', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
  });

  it('can save an explicit Unlimited cap (-1) and keeps the overrides it did not touch', async () => {
    let patch: { custom_limits?: Record<string, number | null> } = {};
    server.use(
      http.get(`${API_BASE}/api/v1/admin/organizations/org-9`, () => HttpResponse.json(org)),
      http.patch(`${API_BASE}/api/v1/admin/organizations/org-9`, async ({ request }) => {
        patch = (await request.json()) as typeof patch;
        return HttpResponse.json(org);
      })
    );
    const user = userEvent.setup();
    render(<AdminOrganizationDetail orgId="org-9" />);

    await user.click(await screen.findByRole('button', { name: /edit limits/i }));
    const queuesInput = await screen.findByLabelText('Max Queues');
    const unlimited = queuesInput.parentElement!.querySelector('input[type="checkbox"]')!;
    await user.click(unlimited);
    expect(queuesInput).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /save limits/i }));

    await waitFor(() => expect(patch.custom_limits).toBeDefined());
    expect(patch.custom_limits).toEqual({ max_workers: 5, job_retention_days: 30, max_queues: -1 });
  });
});

describe('AdminOrganizationDetail new API key', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
  });

  async function createKey(user: ReturnType<typeof userEvent.setup>) {
    server.use(
      http.get(`${API_BASE}/api/v1/admin/organizations/org-9`, () => HttpResponse.json(org)),
      http.post(`${API_BASE}/api/v1/admin/organizations/org-9/api-keys`, () =>
        HttpResponse.json(
          { id: 'k', name: 'ci', key: 'sp_live_once', created_at: '2026-10-11T00:00:00Z' },
          { status: 201 }
        )
      )
    );
    render(<AdminOrganizationDetail orgId="org-9" />);
    await user.click(await screen.findByRole('button', { name: /create key/i }));
    await user.type(await screen.findByLabelText('Key Name'), 'ci');
    await user.click(screen.getAllByRole('button', { name: /create key/i }).pop()!);
    return screen.findByRole('button', { name: /copy api key/i });
  }

  it('copies the one-time key', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(await createKey(user));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sp_live_once'));
    expect(screen.queryByText(/could not copy automatically/i)).not.toBeInTheDocument();
  });

  it('points at the selectable key when the clipboard is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    await user.click(await createKey(user));
    expect(await screen.findByText(/could not copy automatically/i)).toBeInTheDocument();
    expect(screen.getByText('sp_live_once')).toBeInTheDocument();
  });
});
