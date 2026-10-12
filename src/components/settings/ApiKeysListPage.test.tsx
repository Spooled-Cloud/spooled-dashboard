import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from '@/test/utils';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { mockApiKeys } from '@/test/mocks/handlers';
import { useAuthStore } from '@/stores/auth';
import { ApiKeysListPage } from './ApiKeysListPage';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

describe('ApiKeysListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows the rate limit per minute, not per second', async () => {
    render(<ApiKeysListPage />);
    await waitFor(() => expect(screen.getByText('120 requests/min')).toBeInTheDocument());
    expect(screen.queryByText(/req\/s/)).not.toBeInTheDocument();
  });

  it('badges system keys only, with an explanatory tooltip', async () => {
    render(<ApiKeysListPage />);
    const badge = await screen.findByText('System');
    expect(badge).toHaveAttribute(
      'title',
      'Created for dashboard sign-in; does not count toward your key limit'
    );
    expect(screen.getAllByText('System')).toHaveLength(1);
  });

  it('warns that revoking a system key ends dashboard sessions', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    const prev = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...prev, api_key_id: 'some-other-key' } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');
    const buttons = screen.getAllByRole('button', { name: /revoke/i });
    await user.click(buttons[1]);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('ends dashboard sessions'));
    await user.click(buttons[0]);
    expect(confirmSpy).toHaveBeenLastCalledWith(
      expect.not.stringContaining('ends dashboard sessions')
    );
    confirmSpy.mockRestore();
  });

  it('does not allow revoking the key behind the current session', async () => {
    // mockAuthenticatedState signs in as key-1
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    expect(screen.getByText('Current session')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /revoke/i });
    // key-1 (current session) is disabled, key-2 stays revocable
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    await user.click(buttons[0]);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('ApiKeysListPage edit', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('has an Edit button on every key, revoked ones included', async () => {
    server.use(
      http.get('https://api.spooled.cloud/api/v1/api-keys', () =>
        HttpResponse.json([
          ...mockApiKeys,
          { ...mockApiKeys[0], id: 'key-9', name: 'Old key', is_active: false },
        ])
      )
    );
    render(<ApiKeysListPage />);
    await screen.findByText('Old key');

    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(3);
    // Revoke stays an action of active keys only
    expect(screen.getAllByRole('button', { name: /revoke/i })).toHaveLength(2);
  });

  it('renames a key from the list and refreshes the list', async () => {
    let listReads = 0;
    let putBody: Record<string, unknown> | undefined;
    server.use(
      http.get('https://api.spooled.cloud/api/v1/api-keys', () => {
        listReads += 1;
        return HttpResponse.json(mockApiKeys);
      }),
      http.put('https://api.spooled.cloud/api/v1/api-keys/:id', async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...mockApiKeys[1], ...putBody });
      })
    );
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');
    const readsBefore = listReads;

    // The second key is not the one behind this session (key-1)
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[1]);
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('Dashboard session');
    await user.clear(name);
    await user.type(name, 'Renamed');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(putBody).toEqual({ name: 'Renamed' }));
    await waitFor(() => expect(listReads).toBeGreaterThan(readsBefore));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the key behind this session switched on', async () => {
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Current session');

    // key-1 is the session key
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Key is active')).toBeDisabled();
  });
});

describe('ApiKeysListPage session-key guard when /auth/me did not load', () => {
  const API = 'https://api.spooled.cloud/api/v1';
  let authMeCalls = 0;
  let deletes: string[] = [];
  let puts: Array<{ id: string; body: Record<string, unknown> }> = [];

  const meFor = (keyId: string) =>
    http.get(`${API}/auth/me`, () => {
      authMeCalls += 1;
      return HttpResponse.json({
        organization_id: 'org-1',
        api_key_id: keyId,
        queues: ['*'],
        issued_at: '2024-01-01T00:00:00Z',
        expires_at: '2099-01-01T00:00:00Z',
      });
    });
  const meFails = () =>
    http.get(`${API}/auth/me`, () => {
      authMeCalls += 1;
      return HttpResponse.json({ message: 'unavailable' }, { status: 503 });
    });

  beforeEach(async () => {
    await mockAuthenticatedState();
    // /auth/me never loaded: the session key is unknown
    useAuthStore.setState({ user: null });
    queryClient.clear();
    authMeCalls = 0;
    deletes = [];
    puts = [];
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
    server.use(
      http.delete(`${API}/api-keys/:id`, ({ params }) => {
        deletes.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      http.put(`${API}/api-keys/:id`, async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        puts.push({ id: String(params.id), body });
        return HttpResponse.json({ ...mockApiKeys[0], id: String(params.id), ...body });
      })
    );
  });

  it('asks /auth/me again and refuses to revoke when the session key is still unknown', async () => {
    server.use(meFails());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');
    // Nothing marks a key as the session key while it is unknown
    expect(screen.queryByText('Current session')).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: /revoke/i });
    expect(buttons[0]).toBeEnabled();
    await user.click(buttons[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/cannot tell which key/i);
    expect(authMeCalls).toBe(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deletes).toEqual([]);
    confirmSpy.mockRestore();
  });

  it('refuses to revoke the session key once /auth/me says which it is, and marks it', async () => {
    server.use(meFor('key-1'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    await user.click(screen.getAllByRole('button', { name: /revoke/i })[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('This key is your current session');
    expect(authMeCalls).toBe(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deletes).toEqual([]);
    // The store now knows: the key is marked and its button is off
    expect(await screen.findByText('Current session')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /revoke/i })[0]).toBeDisabled();
    confirmSpy.mockRestore();
  });

  it('revokes another key after /auth/me names the session key', async () => {
    server.use(meFor('key-1'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    await user.click(screen.getAllByRole('button', { name: /revoke/i })[1]);

    await waitFor(() => expect(deletes).toEqual(['key-2']));
    expect(authMeCalls).toBe(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('does not ask /auth/me again when the session key is known', async () => {
    await mockAuthenticatedState();
    server.use(meFails());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    await user.click(screen.getAllByRole('button', { name: /revoke/i })[1]);

    await waitFor(() => expect(deletes).toEqual(['key-2']));
    expect(authMeCalls).toBe(0);
    confirmSpy.mockRestore();
  });

  it('refuses to switch a key off from the edit dialog while the session key is unknown', async () => {
    server.use(meFails());
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[1]);
    const dialog = await screen.findByRole('dialog');
    // Nothing disables the box while the session key is unknown...
    const active = within(dialog).getByLabelText('Key is active');
    expect(active).toBeEnabled();
    await user.click(active);
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    // ...so the save is what refuses
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /could not confirm which api key your dashboard session uses/i
    );
    expect(authMeCalls).toBe(1);
    expect(puts).toEqual([]);
  });

  it('refuses to switch the session key off from the edit dialog once /auth/me names it', async () => {
    server.use(meFor('key-1'));
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Key is active'));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /cannot be switched off here/i
    );
    expect(puts).toEqual([]);
  });
});
