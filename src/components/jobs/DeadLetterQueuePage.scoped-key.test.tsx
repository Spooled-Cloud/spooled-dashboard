/**
 * Dead-letter actions for a queue-scoped key. The backend refuses `job_ids` on
 * `POST /jobs/dlq/retry` and a purge without `queue_name` to such a key (403), so the
 * dashboard retries per job and purges one queue at a time.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { mockDashboard } from '@/test/mocks/handlers';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { DeadLetterQueuePage } from './DeadLetterQueuePage';
import { DeadLetterActionBar } from '@/components/dashboard/DashboardHomeEnhanced';

const API_BASE = 'https://api.spooled.cloud';

async function scopeSessionTo(queues: string[]) {
  const { useAuthStore } = await import('@/stores/auth');
  const s = useAuthStore.getState();
  useAuthStore.setState({ user: { ...s.user!, queues } });
}

function bulkRetryRefusedForScopedKeys(onCall: (body: Record<string, unknown>) => void) {
  return http.post(`${API_BASE}/api/v1/jobs/dlq/retry`, async ({ request }) => {
    onCall((await request.json()) as Record<string, unknown>);
    return HttpResponse.json(
      {
        error: 'forbidden',
        message: 'Queue-scoped API keys must retry DLQ by queue_name, not job_ids',
      },
      { status: 403 }
    );
  });
}

describe('DeadLetterQueuePage with a queue-scoped key', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    await scopeSessionTo(['emails']);
  });

  it('retries a dead-lettered job through POST /jobs/{id}/retry, not job_ids', async () => {
    let bulkBody: Record<string, unknown> | undefined;
    const retried: string[] = [];
    server.use(
      bulkRetryRefusedForScopedKeys((body) => (bulkBody = body)),
      http.post(`${API_BASE}/api/v1/jobs/:id/retry`, ({ params }) => {
        retried.push(String(params.id));
        return HttpResponse.json({
          id: params.id,
          organization_id: 'org-1',
          queue_name: 'emails',
          status: 'pending',
          payload: {},
          retry_count: 0,
          max_retries: 3,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          priority: 0,
          timeout_seconds: 300,
        });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);
    const retryButtons = await screen.findAllByTitle('Retry job');
    await user.click(retryButtons[0]);
    const confirm = await screen.findAllByRole('button', { name: /^retry$/i });
    await user.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(retried).toEqual(['job-dlq-1']));
    expect(bulkBody).toBeUndefined();
    expect(screen.queryByText(/must retry DLQ by queue_name/i)).not.toBeInTheDocument();
  });

  it('does not offer Purge All until a queue is named, then purges only that queue', async () => {
    let purgeBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_BASE}/api/v1/jobs/dlq/purge`, async ({ request }) => {
        purgeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ purged_count: 1 });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);

    const purge = await screen.findByRole('button', { name: /purge all/i });
    expect(purge).toBeDisabled();
    expect(screen.getByText('Filter by one of your queues to purge')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Filter by queue...'), 'emails');
    await waitFor(() => expect(screen.getByRole('button', { name: /purge all/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /purge all/i }));
    await user.type(await screen.findByRole('textbox', { name: /type|confirm/i }), 'PURGE');
    const confirmButtons = screen.getAllByRole('button', { name: /purge all/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(purgeBody).toBeDefined());
    expect(purgeBody).toMatchObject({ queue_name: 'emails', confirm: true });
  });
});

describe('DeadLetterQueuePage with an unrestricted key', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('still retries selected jobs in one job_ids request', async () => {
    let bulkBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_BASE}/api/v1/jobs/dlq/retry`, async ({ request }) => {
        bulkBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ retried_count: 1, retried_jobs: ['job-dlq-1'] });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);
    const retryButtons = await screen.findAllByTitle('Retry job');
    await user.click(retryButtons[0]);
    const confirm = await screen.findAllByRole('button', { name: /^retry$/i });
    await user.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(bulkBody).toEqual({ job_ids: ['job-dlq-1'] }));
  });
});

describe('DeadLetterActionBar with a queue-scoped key', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    await scopeSessionTo(['emails']);
  });

  it('hides Retry all and Purge, which name no queue, and keeps the link to the DLQ page', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json({ ...mockDashboard, jobs: { ...mockDashboard.jobs, deadletter: 7 } })
      )
    );
    render(<DeadLetterActionBar />);

    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute('href', '/jobs/dlq');
    expect(screen.queryByRole('button', { name: /retry all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /purge/i })).not.toBeInTheDocument();
  });
});
