/**
 * Billing email confirmation: email sign-in only resolves an organization by a
 * confirmed billing email, so an unconfirmed one offers the code flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { BillingEmailVerification } from './OrganizationSettings';
import type { Organization } from '@/lib/types';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const baseOrg: Organization = {
  id: 'org-1',
  name: 'Test Organization',
  slug: 'test-org',
  plan_tier: 'free',
  billing_email: 'owner@example.com',
  billing_email_verified_at: null,
  settings: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('BillingEmailVerification', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows a confirmed badge for a verified billing email', () => {
    render(
      <BillingEmailVerification
        org={{ ...baseOrg, billing_email_verified_at: '2026-10-10T00:00:00Z' }}
      />
    );
    expect(screen.getByTestId('billing-email-verified')).toHaveTextContent('Confirmed');
  });

  it('renders nothing without a billing email', () => {
    const { container } = render(
      <BillingEmailVerification org={{ ...baseOrg, billing_email: undefined }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('sends a code and confirms the address', async () => {
    const user = userEvent.setup();
    render(<BillingEmailVerification org={baseOrg} />);

    await user.click(screen.getByRole('button', { name: /send confirmation code/i }));
    const input = await screen.findByLabelText(/confirmation code/i);
    expect(screen.getByText(/sent to o\*\*\*r@example.com/i)).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirm).toBeDisabled();

    await user.type(input, '123456');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(screen.queryByLabelText(/confirmation code/i)).not.toBeInTheDocument();
    });
  });

  it('keeps the form and shows the backend message for a wrong code (400, not a session expiry)', async () => {
    const user = userEvent.setup();
    vi.mocked(toast.error).mockClear();
    render(<BillingEmailVerification org={baseOrg} />);

    await user.click(screen.getByRole('button', { name: /send confirmation code/i }));
    await user.type(await screen.findByLabelText(/confirmation code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('Could not confirm the billing email', {
      description: 'Invalid or expired code',
    });
    expect(screen.getByLabelText(/confirmation code/i)).toBeInTheDocument();
    // A 401 would have run the token refresh path and could clear the session
    expect(useAuthStore.getState().accessToken).toBe('test-access-token');
  });

  describe('pending billing-email change', () => {
    const verifiedOrg = {
      ...baseOrg,
      billing_email_verified_at: '2026-10-10T00:00:00Z',
      pending_billing_email: 'new@example.com',
    };

    it('keeps the verified address as sign-in email and offers the code flow for the new one', async () => {
      render(<BillingEmailVerification org={verifiedOrg} />);

      const note = screen.getByTestId('billing-email-pending');
      expect(note).toHaveTextContent('owner@example.com stays your sign-in email');
      expect(note).toHaveTextContent('new@example.com');
      expect(screen.getByTestId('billing-email-verified')).toHaveTextContent('Confirmed');
      expect(screen.getByRole('button', { name: /send confirmation code/i })).toBeInTheDocument();
    });

    it('sends the code and reads the pending address from the response', async () => {
      const user = userEvent.setup();
      render(<BillingEmailVerification org={verifiedOrg} />);

      await user.click(screen.getByRole('button', { name: /send confirmation code/i }));
      expect(await screen.findByLabelText(/confirmation code/i)).toBeInTheDocument();
      expect(screen.getByText(/sent to o\*\*\*r@example.com/i)).toBeInTheDocument();
    });
  });
});
