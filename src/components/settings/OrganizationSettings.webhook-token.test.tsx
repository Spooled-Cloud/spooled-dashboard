/**
 * The incoming-webhook token section when GET /organizations/webhook-token does not answer
 * with a token. A failed read must never say "no token configured": that text invites a
 * regenerate, which rotates the live token and breaks every sender that uses it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { WebhookTokenSection } from './OrganizationSettings';

const API_BASE = 'https://api.spooled.cloud';
const TOKEN_URL = `${API_BASE}/api/v1/organizations/webhook-token`;

describe('WebhookTokenSection when the token cannot be read', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('hides the section on 403 instead of claiming no token is configured', async () => {
    let reads = 0;
    server.use(
      http.get(TOKEN_URL, () => {
        reads++;
        return HttpResponse.json(
          {
            error: 'forbidden',
            message: 'read organization webhook tokens requires an unrestricted key',
          },
          { status: 403 }
        );
      })
    );
    const { container } = render(<WebhookTokenSection orgId="org-1" />);
    await waitFor(() => expect(reads).toBe(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText(/No webhook token configured/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regenerate token/i })).not.toBeInTheDocument();
  });

  it('on a 500 shows the error with Retry and no "no token" text or Regenerate', async () => {
    let fail = true;
    server.use(
      http.get(TOKEN_URL, () =>
        fail
          ? HttpResponse.json({ error: 'internal' }, { status: 500 })
          : HttpResponse.json({
              webhook_url: 'https://api.spooled.cloud/api/v1/webhooks/org-1/custom',
              webhook_token: ['whk', 'fixture', 'token'].join('_'),
            })
      )
    );
    const user = userEvent.setup();
    render(<WebhookTokenSection orgId="org-1" />);

    expect(await screen.findByText('Could not load the webhook token')).toBeInTheDocument();
    expect(screen.queryByText(/No webhook token configured/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/blocked until you regenerate/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regenerate token/i })).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole('button', { name: /try again|retry/i }));
    expect(await screen.findByRole('button', { name: /copy webhook token/i })).toBeInTheDocument();
  });

  it('does not ask at all for a queue-scoped session', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    const s = useAuthStore.getState();
    useAuthStore.setState({ user: { ...s.user!, queues: ['emails'] } });
    let reads = 0;
    server.use(
      http.get(TOKEN_URL, () => {
        reads++;
        return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
      })
    );
    const { container } = render(<WebhookTokenSection orgId="org-1" />);
    expect(container).toBeEmptyDOMElement();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads).toBe(0);
  });
});
