/**
 * Saving the plan or the Stripe link reloads the organization: the plan decides the limits and
 * usage meters, and merging the pre-save state over the reloaded one put stale values back.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { setAdminKey } from '@/lib/api/admin';
import { AdminOrganizationDetail } from './AdminOrganizationDetail';

const API_BASE = 'https://api.spooled.cloud';
const ORG_URL = `${API_BASE}/api/v1/admin/organizations/org-9`;

beforeAll(() => {
  // Radix Select needs these in jsdom.
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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

/** The organization as the backend reports it once it is on the Pro plan. */
const proOrg = {
  ...org,
  plan_tier: 'pro',
  usage_info: {
    ...org.usage_info,
    plan: 'pro',
    plan_display_name: 'Pro',
    limits: { ...limits, tier: 'pro', display_name: 'Pro', max_workers: 50 },
  },
};

describe('AdminOrganizationDetail reloads after a save', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
  });

  it('shows the limits of the new plan after the plan is saved', async () => {
    let current: typeof org = org;
    let reads = 0;
    server.use(
      http.get(ORG_URL, () => {
        reads++;
        return HttpResponse.json(current);
      }),
      http.patch(ORG_URL, async ({ request }) => {
        const body = (await request.json()) as { plan_tier?: string };
        if (body.plan_tier === 'pro') current = proOrg;
        // The PATCH answer is the plain organization row, without usage or limits.
        return HttpResponse.json({ id: 'org-9', name: 'Acme', plan_tier: body.plan_tier });
      })
    );
    const user = userEvent.setup();
    render(<AdminOrganizationDetail orgId="org-9" />);

    expect(await screen.findByText(/current usage against free plan limits/i)).toBeInTheDocument();
    await user.click(screen.getByRole('combobox'));
    await user.click(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Pro' })
    );
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/current usage against pro plan limits/i)).toBeInTheDocument();
    expect(reads).toBe(2);
  });

  it('keeps the reloaded organization after the Stripe link is saved', async () => {
    let current: Record<string, unknown> = org;
    server.use(
      http.get(ORG_URL, () => HttpResponse.json(current)),
      http.patch(ORG_URL, () => {
        // Linking a subscription moved the org to Pro behind the scenes.
        current = { ...proOrg, stripe_customer_id: 'cus_1' };
        return HttpResponse.json({ id: 'org-9', name: 'Acme', plan_tier: 'free' });
      })
    );
    const user = userEvent.setup();
    render(<AdminOrganizationDetail orgId="org-9" />);

    await user.click(await screen.findByRole('button', { name: /link stripe/i }));
    await user.type(await screen.findByLabelText('Stripe Customer ID'), 'cus_1');
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText(/current usage against pro plan limits/i)).toBeInTheDocument()
    );
  });
});
