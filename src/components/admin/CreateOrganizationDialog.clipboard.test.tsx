import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { setAdminKey } from '@/lib/api/admin';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';

const API_BASE = 'https://api.spooled.cloud';

describe('CreateOrganizationDialog copying the one-time key', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
    server.use(
      http.post(`${API_BASE}/api/v1/admin/organizations`, () =>
        HttpResponse.json(
          {
            organization: {
              id: 'org-new',
              name: 'Acme',
              slug: 'acme',
              plan_tier: 'free',
              billing_email: null,
              created_at: '2026-10-11T00:00:00Z',
              updated_at: '2026-10-11T00:00:00Z',
            },
            api_key: {
              id: 'key-1',
              key: 'sp_live_once',
              name: 'Initial Admin Key',
              created_at: '2026-10-11T00:00:00Z',
            },
          },
          { status: 201 }
        )
      )
    );
  });

  async function createOrganization(user: ReturnType<typeof userEvent.setup>) {
    render(<CreateOrganizationDialog />);
    await user.click(screen.getByRole('button', { name: /create organization/i }));
    await user.type(await screen.findByLabelText(/organization name/i), 'Acme');
    await user.click(screen.getAllByRole('button', { name: /create organization/i }).pop()!);
    return screen.findByRole('button', { name: /copy api key/i });
  }

  it('copies the key', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(await createOrganization(user));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sp_live_once'));
    expect(screen.queryByText(/could not copy automatically/i)).not.toBeInTheDocument();
  });

  it('points at the selectable key when the clipboard is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    await user.click(await createOrganization(user));
    expect(await screen.findByText(/could not copy automatically/i)).toBeInTheDocument();
    expect(screen.getByTestId('admin-created-api-key')).toHaveTextContent('sp_live_once');
  });
});
