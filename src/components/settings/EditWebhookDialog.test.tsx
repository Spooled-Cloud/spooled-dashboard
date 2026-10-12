import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import type { Webhook } from '@/lib/api/webhooks';
import { EditWebhookDialog } from './EditWebhookDialog';

const API_BASE = 'https://api.spooled.cloud';

const baseWebhook: Webhook = {
  id: 'webhook-1',
  organization_id: 'org-1',
  name: 'Slack Notifications',
  url: 'https://hooks.slack.com/services/xxx',
  events: ['job.completed', 'job.deadlettered'],
  format: 'slack',
  enabled: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  failure_count: 0,
};

function captureUpdate() {
  const captured: { body?: Record<string, unknown> } = {};
  server.use(
    http.put(`${API_BASE}/api/v1/outgoing-webhooks/:id`, async ({ request }) => {
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...baseWebhook, ...captured.body });
    })
  );
  return captured;
}

function renderDialog(webhook: Webhook) {
  return render(<EditWebhookDialog webhook={webhook} open onOpenChange={vi.fn()} />);
}

describe('EditWebhookDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows the webhook format and the new events it subscribes to', async () => {
    renderDialog(baseWebhook);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText('Format')).toHaveValue('slack');
    expect(within(dialog).getByRole('checkbox', { name: /job dead-lettered/i })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /workflow failed/i })).not.toBeChecked();
  });

  it('does not send the format when it was not changed', async () => {
    const captured = captureUpdate();
    const user = userEvent.setup();
    renderDialog(baseWebhook);
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body).not.toHaveProperty('format');
    expect(captured.body).toMatchObject({ name: 'Slack Notifications' });
  });

  it('sends a changed format, and subscribes to a newly ticked event', async () => {
    const captured = captureUpdate();
    const user = userEvent.setup();
    renderDialog(baseWebhook);
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText('Format'), 'discord');
    await user.click(within(dialog).getByRole('checkbox', { name: /workflow failed/i }));
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.format).toBe('discord');
    expect(captured.body?.events).toEqual(['job.completed', 'job.deadlettered', 'workflow.failed']);
  });

  it('can switch a chat webhook back to JSON', async () => {
    const captured = captureUpdate();
    const user = userEvent.setup();
    renderDialog(baseWebhook);
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText('Format'), 'json');
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body?.format).toBe('json'));
  });

  it('has no Format field for a webhook from a backend without formats (0.1.121)', async () => {
    const captured = captureUpdate();
    const user = userEvent.setup();
    const { format: _format, ...older } = baseWebhook;
    renderDialog(older as Webhook);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByLabelText('Format')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body).not.toHaveProperty('format');
  });
});
