import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { APIError } from '@/lib/api/client';
import type { APIKey } from '@/lib/api/api-keys';
import { useAuthStore } from '@/stores/auth';
import { EditApiKeyDialog, apiKeyCapMessage } from './EditApiKeyDialog';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';

const activeKey: APIKey = {
  id: 'key-1',
  name: 'Production API Key',
  queues: ['default'],
  rate_limit: null,
  is_system: false,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  last_used: null,
  expires_at: null,
};
const revokedKey: APIKey = { ...activeKey, id: 'key-9', name: 'Old key', is_active: false };
// mockAuthenticatedState signs in as key-1, so this one is NOT the session key
const otherKey: APIKey = { ...activeKey, id: 'key-2', name: 'CI key' };

function capturePut(reply?: (body: Record<string, unknown>) => Response) {
  const captured: { id?: string; body?: Record<string, unknown>; calls: number } = { calls: 0 };
  server.use(
    http.put(`${API_BASE}/api/v1/api-keys/:id`, async ({ params, request }) => {
      captured.calls += 1;
      captured.id = String(params.id);
      captured.body = (await request.json()) as Record<string, unknown>;
      return reply ? reply(captured.body) : HttpResponse.json({ ...activeKey, ...captured.body });
    })
  );
  return captured;
}

function renderDialog(apiKey: APIKey, isCurrentSession = false) {
  const onOpenChange = vi.fn();
  const view = render(
    <EditApiKeyDialog
      apiKey={apiKey}
      open
      onOpenChange={onOpenChange}
      isCurrentSession={isCurrentSession}
    />
  );
  return { onOpenChange, view };
}

/** `/auth/me` as the dashboard reads it; counts the calls and can fail or name another key. */
function useAuthMe(reply: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.get(`${API_BASE}/api/v1/auth/me`, () => {
      calls.count += 1;
      return reply();
    })
  );
  return calls;
}

const meFor = (keyId: string) => () =>
  HttpResponse.json({
    organization_id: 'org-1',
    api_key_id: keyId,
    queues: ['*'],
    issued_at: '2024-01-01T00:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
  });
const meFails = () => HttpResponse.json({ message: 'unavailable' }, { status: 503 });

describe('EditApiKeyDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.mocked(toast.success).mockClear();
  });

  it('renames a key and sends only the name', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(activeKey);
    const dialog = await screen.findByRole('dialog');

    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('Production API Key');
    await user.clear(name);
    await user.type(name, '  CI deploys  ');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.id).toBe('key-1');
    expect(captured.body).toEqual({ name: 'CI deploys' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('API key updated'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches a key off, with a warning, and sends only is_active', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    renderDialog(otherKey);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('Key is active'));
    expect(within(dialog).getByText(/stops working as soon as you save/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toEqual({ is_active: false }));
  });

  it('re-activates a revoked key and warns that it takes one of the plan’s key slots', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    renderDialog(revokedKey);
    const dialog = await screen.findByRole('dialog');

    const active = within(dialog).getByLabelText('Key is active');
    expect(active).not.toBeChecked();
    await user.click(active);
    expect(
      within(dialog).getByText(/counts against your plan’s api key limit/i)
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toEqual({ is_active: true }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('API key re-activated'));
  });

  it('shows the plan cap error when re-activation is refused (429 QUOTA_EXCEEDED)', async () => {
    capturePut(() =>
      HttpResponse.json(
        {
          error: 'limit_exceeded',
          code: 'QUOTA_EXCEEDED',
          message: 'api_keys limit reached (20/20)',
          resource: 'api_keys',
          current: 20,
          limit: 20,
          plan: 'pro',
        },
        { status: 429 }
      )
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(revokedKey);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('Key is active'));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(
      await within(dialog).findByText(/api key limit is already reached \(20 of 20 active keys\)/i)
    ).toBeInTheDocument();
    // The dialog stays open so the user can read it and change the choice
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the backend message for any other refusal', async () => {
    capturePut(() =>
      HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Name must be 1-100 characters' },
        { status: 400 }
      )
    );
    const user = userEvent.setup();
    renderDialog(activeKey);
    const dialog = await screen.findByRole('dialog');

    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'x');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(await within(dialog).findByText('Name must be 1-100 characters')).toBeInTheDocument();
  });

  it('refuses an empty name without calling the API', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    renderDialog(activeKey);
    const dialog = await screen.findByRole('dialog');

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(await within(dialog).findByText('API key name is required')).toBeInTheDocument();
    expect(captured.calls).toBe(0);
  });

  it('closes without a request when nothing changed', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog(activeKey);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(captured.calls).toBe(0);
  });

  it('does not let the key behind this session be switched off, but lets it be renamed', async () => {
    const captured = capturePut();
    const user = userEvent.setup();
    renderDialog(activeKey, true);
    const dialog = await screen.findByRole('dialog');

    const active = within(dialog).getByLabelText('Key is active');
    expect(active).toBeDisabled();
    expect(active).toBeChecked();
    expect(within(dialog).getByText(/your current dashboard session/i)).toBeInTheDocument();

    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Session key');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(captured.body).toEqual({ name: 'Session key' }));
  });

  describe('session-key guard when switching a key off', () => {
    const switchOffAndSave = async (user: ReturnType<typeof userEvent.setup>) => {
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByLabelText('Key is active'));
      await user.click(within(dialog).getByRole('button', { name: /save changes/i }));
      return dialog;
    };

    it('refuses to switch off the session key even when the dialog was not told it is one', async () => {
      // The store knows the session key is key-1; the prop says otherwise (stale or missing)
      const captured = capturePut();
      const calls = useAuthMe(meFor('key-1'));
      const user = userEvent.setup();
      const { onOpenChange } = renderDialog(activeKey, false);

      const dialog = await switchOffAndSave(user);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        /cannot be switched off here/i
      );
      expect(captured.calls).toBe(0);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      // Nothing to look up: the store already knew
      expect(calls.count).toBe(0);
    });

    it('refuses when the session turns out to be this key after the box was unticked', async () => {
      const captured = capturePut();
      const user = userEvent.setup();
      const { onOpenChange, view } = renderDialog(otherKey, false);
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByLabelText('Key is active'));

      // /auth/me answers late: this key is the session. The box stays unticked.
      view.rerender(
        <EditApiKeyDialog apiKey={otherKey} open onOpenChange={onOpenChange} isCurrentSession />
      );
      await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        /cannot be switched off here/i
      );
      expect(captured.calls).toBe(0);
    });

    it('asks /auth/me again when the session key is unknown, and refuses if it is the one', async () => {
      useAuthStore.setState({ user: null });
      const captured = capturePut();
      const calls = useAuthMe(meFor('key-1'));
      const user = userEvent.setup();
      renderDialog(activeKey, false);

      const dialog = await switchOffAndSave(user);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        /cannot be switched off here/i
      );
      expect(calls.count).toBe(1);
      expect(captured.calls).toBe(0);
    });

    it('asks /auth/me again when the session key is unknown, and allows another key', async () => {
      useAuthStore.setState({ user: null });
      const captured = capturePut();
      const calls = useAuthMe(meFor('key-1'));
      const user = userEvent.setup();
      renderDialog(otherKey, false);

      await switchOffAndSave(user);

      await waitFor(() => expect(captured.body).toEqual({ is_active: false }));
      expect(calls.count).toBe(1);
      expect(captured.id).toBe('key-2');
    });

    it('refuses, with a message, when the session key is still unknown after asking again', async () => {
      useAuthStore.setState({ user: null });
      const captured = capturePut();
      const calls = useAuthMe(meFails);
      const user = userEvent.setup();
      const { onOpenChange } = renderDialog(otherKey, false);

      const dialog = await switchOffAndSave(user);

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        /could not confirm which api key your dashboard session uses/i
      );
      expect(calls.count).toBe(1);
      expect(captured.calls).toBe(0);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('does not look the session key up for a re-activation', async () => {
      useAuthStore.setState({ user: null });
      const captured = capturePut();
      const calls = useAuthMe(meFails);
      const user = userEvent.setup();
      renderDialog(revokedKey, false);
      const dialog = await screen.findByRole('dialog');

      await user.click(within(dialog).getByLabelText('Key is active'));
      await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(captured.body).toEqual({ is_active: true }));
      expect(calls.count).toBe(0);
    });

    it('does not look the session key up for a rename', async () => {
      useAuthStore.setState({ user: null });
      const captured = capturePut();
      const calls = useAuthMe(meFails);
      const user = userEvent.setup();
      renderDialog(otherKey, false);
      const dialog = await screen.findByRole('dialog');

      const name = within(dialog).getByLabelText('Name');
      await user.clear(name);
      await user.type(name, 'Renamed');
      await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(captured.body).toEqual({ name: 'Renamed' }));
      expect(calls.count).toBe(0);
    });
  });

  it('says an expired key stays expired when switched on', async () => {
    renderDialog({ ...activeKey, expires_at: '2020-01-01T00:00:00Z' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/has expired/i)).toBeInTheDocument();
  });
});

describe('apiKeyCapMessage', () => {
  it('names the counts when the backend sends them', () => {
    const error = new APIError(429, 'QUOTA_EXCEEDED', 'cap', { current: 5, limit: 5 });
    expect(apiKeyCapMessage(error)).toContain('(5 of 5 active keys)');
  });

  it('still reads well without them', () => {
    const message = apiKeyCapMessage(new APIError(429, 'QUOTA_EXCEEDED', 'cap'));
    expect(message).toContain('API key limit is already reached, so');
    expect(message).not.toContain('active keys)');
  });
});
