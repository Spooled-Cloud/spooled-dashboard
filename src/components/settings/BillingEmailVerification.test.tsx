/**
 * Billing email confirmation: email sign-in only resolves an organization by a
 * confirmed billing email, so an unconfirmed one offers the code flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { BillingEmailVerification } from './OrganizationSettings';
import type { Organization } from '@/lib/types';

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
});
