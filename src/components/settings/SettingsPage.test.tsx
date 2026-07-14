/**
 * Integration Tests for SettingsPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { SettingsPage } from './SettingsPage';
import { mockAuthenticatedState } from '@/test/utils';

describe('SettingsPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('should render the page title', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('should display grouped sections', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organization' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Session & profile' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    });
  });

  it('should display Session link', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Session')).toBeInTheDocument();
    });
  });

  it('should display API Keys and Webhooks links', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });
  });

  it('should have correct link destinations', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      const sessionLink = screen.getByRole('link', { name: /session/i });
      expect(sessionLink).toHaveAttribute('href', '/settings/profile');

      const orgLink = screen.getByRole('link', {
        name: /name, slug, members, and webhook signing token/i,
      });
      expect(orgLink).toHaveAttribute('href', '/settings/organization');

      const apiKeysLink = screen.getByRole('link', { name: /api keys/i });
      expect(apiKeysLink).toHaveAttribute('href', '/settings/api-keys');

      const webhooksLink = screen.getByRole('link', { name: /webhooks/i });
      expect(webhooksLink).toHaveAttribute('href', '/settings/webhooks');

      const billingLink = screen.getByRole('link', { name: /billing/i });
      expect(billingLink).toHaveAttribute('href', '/settings/billing');
    });
  });
});
