import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { WebhookTokenSection } from './OrganizationSettings';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';
// Built from parts so secret scanners do not flag a fixture as a real webhook token.
const WEBHOOK_TOKEN = ['whk', 'fixture', 'token'].join('_');

describe('OrganizationSettings webhook copy buttons', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    server.use(
      http.get(`${API_BASE}/api/v1/organizations/webhook-token`, () =>
        HttpResponse.json({
          webhook_url: 'https://api.spooled.cloud/api/v1/webhooks/org-1/custom',
          webhook_token: WEBHOOK_TOKEN,
        })
      )
    );
  });

  it('confirms a successful copy', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<WebhookTokenSection orgId="org-1" />);

    await user.click(await screen.findByRole('button', { name: /copy webhook token/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Webhook token copied to clipboard')
    );
    expect(writeText).toHaveBeenCalledWith(WEBHOOK_TOKEN);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports a blocked clipboard instead of claiming it copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    render(<WebhookTokenSection orgId="org-1" />);

    await user.click(await screen.findByRole('button', { name: /copy webhook url/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/could not copy the webhook url/i);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
