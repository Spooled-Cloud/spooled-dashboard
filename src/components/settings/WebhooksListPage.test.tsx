import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { mockWebhooks } from '@/test/mocks/handlers';
import { WebhooksListPage } from './WebhooksListPage';

const API_BASE = 'https://api.spooled.cloud';

describe('WebhooksListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start every test from an empty cache.
    queryClient.clear();
  });

  it('shows the delivery format of each webhook', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks`, () =>
        HttpResponse.json([
          { ...mockWebhooks[0], format: 'slack' },
          { ...mockWebhooks[0], id: 'webhook-2', name: 'Team channel', format: 'teams' },
          { ...mockWebhooks[0], id: 'webhook-3', name: 'Plain', format: 'json' },
        ])
      )
    );
    render(<WebhooksListPage />);

    expect(await screen.findByTestId('webhook-format-webhook-1')).toHaveTextContent('Slack');
    expect(screen.getByTestId('webhook-format-webhook-2')).toHaveTextContent('Microsoft Teams');
    expect(screen.getByTestId('webhook-format-webhook-3')).toHaveTextContent('JSON');
  });

  it('shows no format for a backend that does not send one (0.1.121)', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks`, () => {
        const { format: _format, ...older } = mockWebhooks[0];
        return HttpResponse.json([older]);
      })
    );
    render(<WebhooksListPage />);

    expect(await screen.findByText('Slack Notifications')).toBeInTheDocument();
    expect(screen.queryByTestId('webhook-format-webhook-1')).not.toBeInTheDocument();
  });

  it('opens the edit dialog with the webhook format', async () => {
    const user = userEvent.setup();
    render(<WebhooksListPage />);
    await user.click(await screen.findByTitle('Edit Webhook'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Format')).toHaveValue('slack');
  });

  it('shows the incoming webhook log below the outgoing webhooks', async () => {
    render(<WebhooksListPage />);

    const log = await screen.findByTestId('inbound-webhook-log');
    expect(within(log).getByText('Incoming webhook log')).toBeInTheDocument();
    expect((await within(log).findAllByText('order.created')).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Outgoing Webhooks' })
    ).toBeInTheDocument();
  });

  it('keeps the outgoing webhooks when the log is refused for this key (403)', async () => {
    let logCalls = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/webhooks/deliveries`, () => {
        logCalls += 1;
        return HttpResponse.json(
          {
            code: 'ACCESS_DENIED',
            message: 'Queue-scoped API keys cannot read the inbound webhook log',
          },
          { status: 403 }
        );
      })
    );
    render(<WebhooksListPage />);

    expect(await screen.findByText('Slack Notifications')).toBeInTheDocument();
    await waitFor(() => expect(logCalls).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.queryByTestId('inbound-webhook-log')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Slack Notifications')).toBeInTheDocument();
  });
});
