import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { mockOrganization } from '@/test/mocks/handlers';
import { useAuthStore } from '@/stores/auth';
import { LoginPage } from './LoginPage';

const API_BASE = 'https://api.spooled.cloud';

const mockLocation = {
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
};

describe('LoginPage session replace', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });
    mockLocation.href = 'http://localhost:3000/';
    sessionStorage.removeItem('redirect_after_login');
    useAuthStore.setState({
      accessToken: 'old-token',
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + 60_000,
      user: {
        organization_id: 'org-a',
        api_key_id: 'key-a',
        queues: ['*'],
        issued_at: '2024-01-01T00:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
      },
      currentOrganization: {
        id: 'org-a',
        name: 'Acme',
        slug: 'acme',
        plan_tier: 'free',
        settings: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      organizations: [],
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('does not navigate on a timer ahead of the new organization', () => {
    const src = readFileSync('src/components/auth/LoginPage.tsx', 'utf8');
    expect(src).not.toContain('setTimeout');
    expect(src.match(/await setAuth\(/g)).toHaveLength(2);
  });

  it('clears the previous organization and leaves only after the new profile loads', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_BASE}/api/v1/auth/me`, async () => {
        await gate;
        return HttpResponse.json({
          organization_id: 'org-b',
          api_key_id: 'key-b',
          queues: ['*'],
          issued_at: '2024-01-01T00:00:00Z',
          expires_at: '2099-01-01T00:00:00Z',
        });
      }),
      http.get(`${API_BASE}/api/v1/organizations/:id`, ({ params }) =>
        HttpResponse.json({
          ...mockOrganization,
          id: String(params.id),
          name: 'Beta',
        })
      )
    );

    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText('API Key'), 'sp_test_example');
    // Don't await: React does not return the submit promise, so the click
    // settles at the first await inside the handler, before navigation.
    void user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('test-access-token'));
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().currentOrganization).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockLocation.href).not.toContain('dashboard');

    release();
    await waitFor(() => expect(mockLocation.href).toBe('/dashboard'));
    expect(useAuthStore.getState().currentOrganization?.id).toBe('org-b');
    expect(useAuthStore.getState().currentOrganization?.name).toBe('Beta');
  });
});
