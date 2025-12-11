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

  it('should display Profile link', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  it('should display Organization section and link', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      // There are multiple "Organization" elements - check for both
      const orgElements = screen.getAllByText('Organization');
      expect(orgElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should display API Keys link', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('API Keys')).toBeInTheDocument();
    });
  });

  it('should display Webhooks link', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });
  });

  it('should have correct link destinations', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      // Check that links are present and have correct hrefs
      const profileLink = screen.getByRole('link', { name: /profile/i });
      expect(profileLink).toHaveAttribute('href', '/settings/profile');

      const orgLink = screen.getByRole('link', { name: /organization/i });
      expect(orgLink).toHaveAttribute('href', '/settings/organization');

      const apiKeysLink = screen.getByRole('link', { name: /api keys/i });
      expect(apiKeysLink).toHaveAttribute('href', '/settings/api-keys');

      const webhooksLink = screen.getByRole('link', { name: /webhooks/i });
      expect(webhooksLink).toHaveAttribute('href', '/settings/webhooks');
    });
  });

  it('should show "Coming Soon" for Security Settings', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      const comingSoonElements = screen.getAllByText('Coming Soon');
      expect(comingSoonElements.length).toBeGreaterThan(0);
    });
  });
});
