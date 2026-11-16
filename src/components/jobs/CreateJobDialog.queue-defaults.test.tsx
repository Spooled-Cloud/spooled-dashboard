/**
 * Create Job leaves max_retries out when the field is untouched. The backend uses the queue's
 * configured max_retries only when the request omits the field (`request.max_retries
 * .unwrap_or(queue_defaults.max_retries)`), the same way Timeout already worked.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { CreateJobDialog } from './CreateJobDialog';

const API_BASE = 'https://api.spooled.cloud';

describe('CreateJobDialog keeps the queue max_retries', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  async function createUntouched() {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API_BASE}/api/v1/queues`, () =>
        HttpResponse.json([
          { queue_name: 'payments', max_retries: 0, default_timeout: 60, enabled: true },
        ])
      ),
      http.post(`${API_BASE}/api/v1/jobs`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'job-1', created: true }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    render(<CreateJobDialog />);
    await user.click(screen.getByRole('button', { name: /create job/i }));
    await waitFor(() => expect(screen.getByLabelText('Job Type *')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^queue/i), 'payments');
    await user.type(screen.getByLabelText('Job Type *'), 'charge_card');
    const buttons = screen.getAllByRole('button', { name: /create job/i });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(posted).toBeDefined());
    return posted as Record<string, unknown>;
  }

  it('omits max_retries for a queue configured with max_retries 0 when the field is untouched', async () => {
    const posted = await createUntouched();
    expect(posted).not.toHaveProperty('timeout_seconds');
    expect(posted).not.toHaveProperty('max_retries');
  });

  it('shows the field empty with a queue-default placeholder', async () => {
    const user = userEvent.setup();
    render(<CreateJobDialog />);
    await user.click(screen.getByRole('button', { name: /create job/i }));
    const retries = await screen.findByLabelText('Max Retries');
    expect(retries).toHaveValue(null);
    expect(retries).toHaveAttribute('placeholder', 'Default from queue');
  });
});
