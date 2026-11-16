/**
 * The API keys list against the key shapes the backend really stores: `queues: []` is an
 * all-queues key, and an expired key keeps `is_active: true`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { ApiKeysListPage } from './ApiKeysListPage';
import { getKeyDisplayPrefix } from '@/lib/api/api-keys';

const API_BASE = 'https://api.spooled.cloud';

function key(over: Record<string, unknown>) {
  return {
    id: 'k',
    name: 'k',
    queues: [] as string[],
    rate_limit: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    last_used: null,
    expires_at: null,
    is_system: false,
    ...over,
  };
}

describe('API keys list against real key shapes', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows an all-queues key (queues: []) as having access to all queues', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/api-keys`, () =>
        HttpResponse.json([key({ id: 'all', name: 'All access key', queues: [] })], {
          headers: { 'X-Has-More': 'false' },
        })
      )
    );
    render(<ApiKeysListPage />);
    await screen.findByText('All access key');
    expect(screen.getByText('Queue Access')).toBeInTheDocument();
    expect(screen.getByText('all queues')).toBeInTheDocument();
  });

  it('counts an expired key (is_active true) as Revoked/Expired, not Active', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/api-keys`, () =>
        HttpResponse.json(
          [
            key({ id: 'a', name: 'Live', queues: ['*'] }),
            key({ id: 'b', name: 'Old', queues: ['*'], expires_at: '2020-01-01T00:00:00Z' }),
          ],
          { headers: { 'X-Has-More': 'false' } }
        )
      )
    );
    render(<ApiKeysListPage />);
    await screen.findByText('Old');
    expect(screen.getByText('Expired')).toBeInTheDocument();
    const activeLabel = screen.getByText('Active', { selector: 'p' });
    expect(activeLabel.nextElementSibling?.textContent).toBe('1');
    const revokedLabel = screen.getByText('Revoked/Expired');
    await waitFor(() => expect(revokedLabel.nextElementSibling?.textContent).toBe('1'));
  });
});

describe('getKeyDisplayPrefix', () => {
  it('names an empty scope all queues, like *', () => {
    expect(getKeyDisplayPrefix(key({ queues: [] }) as never)).toBe('all queues');
    expect(getKeyDisplayPrefix(key({ queues: ['*'] }) as never)).toBe('all queues');
    expect(getKeyDisplayPrefix(key({ queues: ['emails'] }) as never)).toBe('emails');
  });
});
