import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { setAdminKey } from '@/lib/api/admin';
import { AdminOrganizationsList } from './AdminOrganizationsList';

const API_BASE = 'https://api.spooled.cloud';

describe('AdminOrganizationsList search', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
  });

  it('debounces typing into a single request and never shows a stale response', async () => {
    const searches: Array<string | null> = [];
    server.use(
      http.get(`${API_BASE}/api/v1/admin/organizations`, async ({ request }) => {
        const search = new URL(request.url).searchParams.get('search');
        searches.push(search);
        return HttpResponse.json({
          organizations: [
            {
              id: 'o1',
              name: search ? `match-${search}` : 'everything',
              slug: 's',
              plan_tier: 'free',
              billing_email: null,
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-01T00:00:00Z',
              usage: { jobs_today: 0, active_jobs: 0, queues: 0, workers: 0, api_keys: 0 },
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        });
      })
    );
    const user = userEvent.setup();
    render(<AdminOrganizationsList />);
    await screen.findByText('everything');

    await user.type(screen.getByPlaceholderText(/search by name or slug/i), 'acme');

    await screen.findByText('match-acme');
    // initial load + exactly one request for the whole word, not one per keystroke
    expect(searches).toEqual([null, 'acme']);
    await waitFor(() => expect(screen.queryByText('everything')).not.toBeInTheDocument());
  });
});
