import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { WEBHOOK_EVENTS } from '@/lib/api/webhooks';
import { CreateWebhookDialog } from './CreateWebhookDialog';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<CreateWebhookDialog />);
  await user.click(screen.getByRole('button', { name: /create webhook/i }));
  return screen.findByRole('dialog');
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.type(within(dialog).getByLabelText(/webhook name/i), 'Alerts');
  await user.type(within(dialog).getByLabelText(/endpoint url/i), 'https://hooks.example.com/x');
  await user.click(within(dialog).getByRole('checkbox', { name: /job failed/i }));
}

/** Capture the body of the next POST /outgoing-webhooks, answering with `reply`. */
function captureCreate(reply: Record<string, unknown> = {}) {
  const captured: { body?: Record<string, unknown> } = {};
  server.use(
    http.post(`${API_BASE}/api/v1/outgoing-webhooks`, async ({ request }) => {
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        { id: 'webhook-new', name: 'Alerts', format: 'json', ...reply },
        { status: 201 }
      );
    })
  );
  return captured;
}

describe('CreateWebhookDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.warning).mockClear();
  });

  it('offers the four events added in backend 0.1.122', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    for (const name of [
      /job dead-lettered/i,
      /job retried/i,
      /workflow completed/i,
      /workflow failed/i,
    ]) {
      expect(within(dialog).getByRole('checkbox', { name })).not.toBeChecked();
    }
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(WEBHOOK_EVENTS.length);
  });

  it('has a Format select: JSON by default, then Slack, Discord and Microsoft Teams', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    const format = within(dialog).getByLabelText('Format');
    expect(format).toHaveValue('json');
    expect(
      within(format)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['JSON', 'Slack', 'Discord', 'Microsoft Teams']);
    expect(within(dialog).getByText(/the signed spooled envelope/i)).toBeInTheDocument();
  });

  it('explains the chosen chat format', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    const format = within(dialog).getByLabelText('Format');

    await user.selectOptions(format, 'slack');
    expect(within(dialog).getByText(/use a slack incoming webhook url/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/chat services do not verify signatures/i)).toBeInTheDocument();

    await user.selectOptions(format, 'discord');
    expect(within(dialog).getByText(/mentions never ping/i)).toBeInTheDocument();

    await user.selectOptions(format, 'teams');
    expect(
      within(dialog).getByText(/power automate workflows urls reject it/i)
    ).toBeInTheDocument();

    await user.selectOptions(format, 'json');
    expect(
      within(dialog).queryByText(/chat services do not verify signatures/i)
    ).not.toBeInTheDocument();
  });

  it('leaves format out of the request for the default JSON (valid for older backends too)', async () => {
    const captured = captureCreate();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await fillRequired(user, dialog);

    await user.click(within(dialog).getByRole('button', { name: /^create webhook$/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body).not.toHaveProperty('format');
    expect(captured.body).toMatchObject({ name: 'Alerts', events: ['job.failed'], enabled: true });
  });

  it.each(['slack', 'discord', 'teams'])('sends format %s', async (format) => {
    const captured = captureCreate({ format });
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await fillRequired(user, dialog);
    await user.selectOptions(within(dialog).getByLabelText('Format'), format);

    await user.click(within(dialog).getByRole('button', { name: /^create webhook$/i }));

    await waitFor(() => expect(captured.body?.format).toBe(format));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('subscribes to the new events when they are ticked, and Select All takes all of them', async () => {
    const captured = captureCreate();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/webhook name/i), 'Alerts');
    await user.type(within(dialog).getByLabelText(/endpoint url/i), 'https://hooks.example.com/x');
    await user.click(within(dialog).getByRole('button', { name: /select all/i }));
    expect(within(dialog).getByText('Selected: 14 events')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^create webhook$/i }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body?.events).toEqual(
      expect.arrayContaining([
        'job.deadlettered',
        'job.retried',
        'workflow.completed',
        'workflow.failed',
      ])
    );
    expect(captured.body?.events).toHaveLength(14);
  });

  it('warns when a backend older than 0.1.122 created the webhook without the chosen format', async () => {
    // 0.1.121 ignores the unknown field and answers without `format`
    server.use(
      http.post(`${API_BASE}/api/v1/outgoing-webhooks`, () =>
        HttpResponse.json({ id: 'webhook-old', name: 'Alerts' }, { status: 201 })
      )
    );
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await fillRequired(user, dialog);
    await user.selectOptions(within(dialog).getByLabelText('Format'), 'slack');

    await user.click(within(dialog).getByRole('button', { name: /^create webhook$/i }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toMatch(/does not support webhook formats/i);
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the backend message when a new event is not known yet (0.1.121)', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/outgoing-webhooks`, () =>
        HttpResponse.json(
          { code: 'VALIDATION_ERROR', message: "Invalid event type 'workflow.failed'" },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await fillRequired(user, dialog);
    await user.click(within(dialog).getByRole('checkbox', { name: /workflow failed/i }));

    await user.click(within(dialog).getByRole('button', { name: /^create webhook$/i }));

    expect(
      await within(dialog).findByText("Invalid event type 'workflow.failed'")
    ).toBeInTheDocument();
  });
});
