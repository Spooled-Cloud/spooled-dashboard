import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';

const API_BASE = 'https://api.spooled.cloud';

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<CreateApiKeyDialog />);
  await user.click(screen.getByRole('button', { name: /create api key/i }));
  return screen.findByLabelText(/key name/i);
}

describe('CreateApiKeyDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('sends the expiration as an RFC 3339 instant, not a bare datetime-local value', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${API_BASE}/api/v1/api-keys`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'k', name: 'ci', key: 'sp_test_abc', created_at: '2026-10-11T00:00:00Z' },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    const name = await openDialog(user);
    await user.type(name, 'ci');
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    const expiry = screen.getByLabelText(/expiration/i);
    await user.type(expiry, local);
    await user.click(screen.getAllByRole('button', { name: /create api key/i }).pop()!);

    await waitFor(() => expect(body.name).toBe('ci'));
    const sent = body.expires_at as string;
    expect(sent).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(new Date(sent).getTime()).toBe(new Date(local).getTime());
  });

  it('rejects an expiration in the past without calling the API', async () => {
    let called = false;
    server.use(
      http.post(`${API_BASE}/api/v1/api-keys`, () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const user = userEvent.setup();
    const name = await openDialog(user);
    await user.type(name, 'ci');
    await user.type(screen.getByLabelText(/expiration/i), '2020-01-01T10:00');
    await user.click(screen.getAllByRole('button', { name: /create api key/i }).pop()!);

    expect(await screen.findByText(/must be in the future/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });

  describe('copying the new key', () => {
    function createKeyResponse() {
      return http.post(`${API_BASE}/api/v1/api-keys`, () =>
        HttpResponse.json(
          { id: 'k', name: 'ci', key: 'sp_test_abc', created_at: '2026-10-11T00:00:00Z' },
          { status: 201 }
        )
      );
    }

    async function createKey(user: ReturnType<typeof userEvent.setup>) {
      const name = await openDialog(user);
      await user.type(name, 'ci');
      await user.click(screen.getAllByRole('button', { name: /create api key/i }).pop()!);
      return screen.findByRole('button', { name: /copy/i });
    }

    it('shows Copied! once the key is on the clipboard', async () => {
      server.use(createKeyResponse());
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');
      await user.click(await createKey(user));
      expect(await screen.findByText('Copied!')).toBeInTheDocument();
      expect(writeText).toHaveBeenCalledWith('sp_test_abc');
    });

    it('points at the key field when the clipboard is blocked', async () => {
      server.use(createKeyResponse());
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
      await user.click(await createKey(user));
      expect(await screen.findByText(/could not copy automatically/i)).toBeInTheDocument();
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });
  });

  it('documents prefix queue patterns such as orders.*', async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText('orders.*')).toBeInTheDocument();
  });
});
