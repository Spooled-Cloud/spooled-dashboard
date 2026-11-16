/**
 * The billing period end is a next billing date only while a live subscription exists. The
 * backend keeps `stripe_current_period_end` after `customer.subscription.deleted`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { BillingPage } from './BillingPage';

const API_BASE = 'https://api.spooled.cloud';

function billingStatus(over: Record<string, unknown>) {
  server.use(
    http.get(`${API_BASE}/api/v1/billing/status`, () =>
      HttpResponse.json({
        plan_tier: 'pro',
        stripe_subscription_id: 'sub_1',
        stripe_subscription_status: 'active',
        stripe_current_period_end: '2099-09-01T00:00:00Z',
        stripe_cancel_at_period_end: false,
        has_stripe_customer: true,
        ...over,
      })
    )
  );
}

describe('BillingPage period end', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('shows no billing date for a canceled, free org', async () => {
    // Shape the backend leaves after customer.subscription.deleted
    // (billing.rs handle_subscription_deleted): id NULL, status canceled, plan free,
    // stripe_current_period_end untouched.
    billingStatus({
      plan_tier: 'free',
      stripe_subscription_id: null,
      stripe_subscription_status: 'canceled',
      stripe_current_period_end: '2026-09-01T00:00:00Z',
    });
    render(<BillingPage />);
    await waitFor(() =>
      expect(screen.getByText(/subscription has been canceled/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/Next billing date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Renews in/i)).not.toBeInTheDocument();
  });

  it('shows the next billing date of a live subscription', async () => {
    billingStatus({});
    render(<BillingPage />);
    expect(await screen.findByText('Next billing date')).toBeInTheDocument();
    expect(screen.getByText('Renews in')).toBeInTheDocument();
  });

  it('says the subscription ends, not renews, when it cancels at the period end', async () => {
    billingStatus({ stripe_cancel_at_period_end: true });
    render(<BillingPage />);
    expect(await screen.findByText('Ends on')).toBeInTheDocument();
    expect(screen.getByText('Ends in')).toBeInTheDocument();
    expect(screen.queryByText(/Next billing date/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Renews in/i)).not.toBeInTheDocument();
    expect(screen.getByText(/will cancel at the end of this billing period/i)).toBeInTheDocument();
  });
});
