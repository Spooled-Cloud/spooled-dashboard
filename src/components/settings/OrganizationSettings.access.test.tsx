import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth';
import { OrganizationSettingsPage } from './OrganizationSettings';

const API_BASE = 'https://api.spooled.cloud';

describe('Organization settings active API key count', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('shows the member count for an unrestricted key', async () => {
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('active-api-key-count')).toHaveTextContent('2');
  });

  it('shows Unavailable instead of 0 when listing members is forbidden', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/organizations/:id/members`, () =>
        HttpResponse.json(
          { code: 'FORBIDDEN', message: 'list organization members' },
          { status: 403 }
        )
      )
    );

    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('active-api-key-count')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('active-api-key-count')).not.toHaveTextContent(/^0$/);
  });

  it('does not request members for a queue-scoped key', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/organizations/:id/members`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: 'FORBIDDEN', message: 'list organization members' },
          { status: 403 }
        );
      })
    );
    const user = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...user, queues: ['emails'] } });

    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('active-api-key-count')).toHaveTextContent('Unavailable');
    expect(calls).toBe(0);
  });
});
