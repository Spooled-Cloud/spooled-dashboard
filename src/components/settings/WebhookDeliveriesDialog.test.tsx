import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { mockWebhooks } from '@/test/mocks/handlers';
import type { Webhook } from '@/lib/api/webhooks';
import { WebhookDeliveriesDialog, hasJsonPayload } from './WebhookDeliveriesDialog';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';

describe('hasJsonPayload', () => {
  it('keeps non-object JSON that Object.keys used to hide', () => {
    expect(hasJsonPayload('hello')).toBe(true);
    expect(hasJsonPayload(false)).toBe(true);
    expect(hasJsonPayload(0)).toBe(true);
    expect(hasJsonPayload([])).toBe(true);
    expect(hasJsonPayload([1])).toBe(true);
  });

  it('treats missing and empty objects as absent', () => {
    expect(hasJsonPayload(undefined)).toBe(false);
    expect(hasJsonPayload(null)).toBe(false);
    expect(hasJsonPayload({})).toBe(false);
  });
});

describe('WebhookDeliveriesDialog retry', () => {
  const webhook = mockWebhooks[0] as unknown as Webhook;

  function failedDelivery(id: string, attempts: number) {
    return {
      id,
      webhook_id: 'webhook-1',
      event: 'job.failed',
      payload: { job_id: 'job-3' },
      status: 'failed',
      status_code: 500,
      response_body: null,
      error: 'HTTP 500',
      attempts,
      created_at: new Date().toISOString(),
      delivered_at: null,
    };
  }

  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  function renderDialog() {
    return render(<WebhookDeliveriesDialog webhook={webhook} open onOpenChange={vi.fn()} />);
  }

  it('offers Retry on a failed delivery only, not on a delivered one', async () => {
    renderDialog();
    await screen.findByText('job.failed');

    // The default mock has one delivered (delivery-1) and one failed (delivery-2) delivery
    const buttons = screen.getAllByRole('button', { name: /^retry/i });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toBeEnabled();
  });

  it('retries the failed delivery and refreshes the history', async () => {
    let retried: string | undefined;
    let historyReads = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id/deliveries`, () => {
        historyReads += 1;
        return HttpResponse.json([failedDelivery('delivery-2', 3)]);
      }),
      http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/retry/:deliveryId`, ({ params }) => {
        retried = `${String(params.id)}/${String(params.deliveryId)}`;
        return HttpResponse.json({ success: true, message: 'Delivery retried successfully' });
      })
    );
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('button', { name: /^retry/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Delivery retried', {
        description: 'Delivery retried successfully',
      })
    );
    expect(retried).toBe('webhook-1/delivery-2');
    await waitFor(() => expect(historyReads).toBeGreaterThan(1));
  });

  it('says so when the endpoint still does not accept the retry (HTTP 200, success false)', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id/deliveries`, () =>
        HttpResponse.json([failedDelivery('delivery-2', 3)])
      ),
      http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/retry/:deliveryId`, () =>
        HttpResponse.json({
          success: false,
          message: 'Delivery retry attempted but target did not return success',
        })
      )
    );
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('button', { name: /^retry/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('The endpoint did not accept the retry', {
      description: 'Delivery retry attempted but target did not return success',
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows the backend reason when it refuses the retry (400)', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id/deliveries`, () =>
        HttpResponse.json([failedDelivery('delivery-2', 3)])
      ),
      http.post(`${API_BASE}/api/v1/outgoing-webhooks/:id/retry/:deliveryId`, () =>
        HttpResponse.json(
          {
            code: 'BAD_REQUEST',
            message: 'Maximum retry attempts (10) exceeded for this delivery',
          },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('button', { name: /^retry/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('Could not retry the delivery', {
      description: 'Maximum retry attempts (10) exceeded for this delivery',
    });
  });

  it('disables Retry once the delivery made the most attempts a manual retry allows', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/outgoing-webhooks/:id/deliveries`, () =>
        HttpResponse.json([failedDelivery('delivery-9', 10), failedDelivery('delivery-8', 9)])
      )
    );
    renderDialog();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findAllByText('job.failed');

    const [exhausted, last] = within(dialog).getAllByRole('button', { name: /^retry/i });
    expect(exhausted).toBeDisabled();
    expect(exhausted).toHaveAttribute('title', expect.stringContaining('10 attempts'));
    expect(last).toBeEnabled();
  });
});
