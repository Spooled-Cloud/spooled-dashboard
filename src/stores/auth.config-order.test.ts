/**
 * The auth store's start-up check must wait for the runtime config.
 *
 * A stored session with no user/organization context makes the store call /auth/me as
 * soon as it loads. Until /api/config has answered, the API client only knows the hosted
 * default host, so a self-hosted dashboard would send the session token there first.
 */

import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { waitFor } from '@testing-library/react';
import { server } from '@/test/mocks/server';

const HOSTED_HOST = 'api.spooled.cloud';
const SELF_HOSTED_API = 'https://api.selfhosted.test';

describe('auth store start-up and runtime config', () => {
  afterEach(() => {
    server.events.removeAllListeners();
    (localStorage.getItem as Mock).mockReset();
    vi.resetModules();
  });

  function storeSession(state: Record<string, unknown>) {
    (localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'auth-storage' ? JSON.stringify({ state, version: 1 }) : null
    );
  }

  it('sends no request to the default host before a delayed /api/config answers', async () => {
    const requested: Array<{ host: string; path: string }> = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      requested.push({ host: url.host, path: url.pathname });
    });
    server.use(
      http.get('/api/config', async () => {
        await delay(150);
        return HttpResponse.json({
          apiUrl: SELF_HOSTED_API,
          wsUrl: 'wss://api.selfhosted.test',
          sentryEnvironment: 'test',
          enableWorkflows: true,
          enableSchedules: true,
          enableAnalytics: false,
        });
      }),
      http.get(`${SELF_HOSTED_API}/api/v1/auth/me`, () =>
        HttpResponse.json({
          organization_id: 'org-1',
          api_key_id: 'key-1',
          queues: ['*'],
          issued_at: '2024-01-01T00:00:00Z',
          expires_at: '2099-01-01T00:00:00Z',
        })
      ),
      http.get(`${SELF_HOSTED_API}/api/v1/organizations/org-1`, () =>
        HttpResponse.json({
          id: 'org-1',
          name: 'Self Hosted',
          slug: 'self-hosted',
          plan_tier: 'pro',
          settings: {},
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        })
      )
    );
    storeSession({
      accessToken: 'valid-jwt',
      expiresAt: Date.now() + 3600_000,
      isAuthenticated: true,
    });

    vi.resetModules();
    const { useAuthStore } = await import('./auth');

    await waitFor(() => expect(useAuthStore.getState().currentOrganization).not.toBeNull());

    // /api/config came first, then everything went to the configured host.
    expect(requested[0]).toEqual({ host: expect.any(String), path: '/api/config' });
    expect(requested.some((r) => r.host === HOSTED_HOST)).toBe(false);
    expect(
      requested.some((r) => r.host === 'api.selfhosted.test' && r.path.endsWith('/auth/me'))
    ).toBe(true);
    expect(useAuthStore.getState().currentOrganization?.name).toBe('Self Hosted');
  });
});
