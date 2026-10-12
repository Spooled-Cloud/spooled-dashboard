/**
 * Integration tests for BillingPage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthenticatedState } from '@/test/utils';
import { BillingPage } from './BillingPage';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { mockBillingStatusFree, mockBillingStatusWithCustomer } from '@/test/mocks/handlers';

const API_BASE = 'https://api.spooled.cloud';

describe('BillingPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('renders billing page title', async () => {
    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Billing', level: 1 })).toBeInTheDocument();
    });
  });

  it('shows honest empty-state copy when no Stripe customer is linked', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/billing/status`, () => {
        return HttpResponse.json(mockBillingStatusFree);
      })
    );

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/no stripe billing account is linked yet/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /open stripe billing portal/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /view pricing on spooled.cloud/i }).length
    ).toBeGreaterThan(0);
  });

  it('does not show in-dashboard plan comparison matrices', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/billing/status`, () => {
        return HttpResponse.json(mockBillingStatusFree);
      })
    );

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/plans & pricing/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('10,000 jobs/day')).not.toBeInTheDocument();
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
  });

  it('shows Stripe portal CTA only when backend reports a Stripe customer', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/billing/status`, () => {
        return HttpResponse.json(mockBillingStatusWithCustomer);
      })
    );

    render(<BillingPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /open stripe billing portal \(new tab\)/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/open stripe's secure billing portal in a new tab/i)
    ).toBeInTheDocument();
  });

  it('opens the portal in the tab opened during the click and does not report a blocked popup', async () => {
    const fakeTab = { opener: {}, closed: false, close: vi.fn(), location: { href: '' } };
    (window.open as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => fakeTab as unknown as Window
    );
    server.use(
      http.get(`${API_BASE}/api/v1/billing/status`, () =>
        HttpResponse.json(mockBillingStatusWithCustomer)
      )
    );
    const user = userEvent.setup();
    render(<BillingPage />);

    await user.click(
      await screen.findByRole('button', { name: /open stripe billing portal \(new tab\)/i })
    );

    await waitFor(() =>
      expect(fakeTab.location.href).toBe('https://billing.stripe.com/session/test')
    );
    expect(fakeTab.opener).toBeNull();
    expect(screen.queryByText(/popup blocked/i)).not.toBeInTheDocument();
  });
});
