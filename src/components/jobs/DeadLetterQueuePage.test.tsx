/**
 * Tests for DeadLetterQueuePage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { render, screen, waitFor, fireEvent, mockAuthenticatedState } from '@/test/utils';
import { DeadLetterQueuePage } from './DeadLetterQueuePage';

const API_BASE = 'https://api.spooled.cloud';

function statsWithDeadLetter(deadletter: number) {
  return HttpResponse.json({
    total: deadletter + 10,
    pending: 10,
    scheduled: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    deadletter,
  });
}

describe('DeadLetterQueuePage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows the real dead-letter total and purges with that limit, not the 100 fetched rows', async () => {
    let purgeBody: Record<string, unknown> | undefined;
    server.use(
      http.get(`${API_BASE}/api/v1/jobs/stats`, () => statsWithDeadLetter(4800)),
      http.post(`${API_BASE}/api/v1/jobs/dlq/purge`, async ({ request }) => {
        purgeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ purged_count: 4800 });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);

    await screen.findByText('4800 jobs in dead-letter queue');
    await user.click(await screen.findByRole('button', { name: /purge all/i }));

    expect(await screen.findByText('4800 job(s) will be permanently deleted')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /type|confirm/i }), 'PURGE');
    const confirmButtons = screen.getAllByRole('button', { name: /purge all/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(purgeBody).toBeDefined());
    expect(purgeBody).toMatchObject({ limit: 4800, confirm: true });
  });

  it('caps the confirmed count at the backend purge limit and says so', async () => {
    server.use(http.get(`${API_BASE}/api/v1/jobs/stats`, () => statsWithDeadLetter(25000)));
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);

    await screen.findByText('25000 jobs in dead-letter queue');
    await user.click(await screen.findByRole('button', { name: /purge all/i }));

    expect(await screen.findByText('10000 job(s) will be permanently deleted')).toBeInTheDocument();
    expect(screen.getByText(/only 10000 of 25000 can be purged per request/i)).toBeInTheDocument();
  });

  it('clears the selection when the queue filter changes', async () => {
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);

    const rowCheckbox = (await screen.findAllByRole('checkbox'))[1];
    await user.click(rowCheckbox);
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/filter by queue/i), 'e');
    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument());
  });
});

function dlqRows(count: number, queue = 'emails') {
  return Array.from({ length: count }, (_, i) => ({
    id: `job-${queue}-${i + 1}`,
    queue_name: queue,
    status: 'deadletter',
    priority: 0,
    attempt: 3,
    max_retries: 3,
    job_type: 'send_notification',
    last_error: 'Connection refused',
    created_at: '2024-01-01T00:03:00Z',
    scheduled_at: null,
    started_at: '2024-01-01T00:03:30Z',
    completed_at: null,
  }));
}

describe('DeadLetterQueuePage refresh, count and purge snapshot', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  async function confirmPurge(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole('textbox', { name: /type|confirm/i }), 'PURGE');
    const confirmButtons = screen.getAllByRole('button', { name: /purge all/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);
  }

  it('Refresh refetches the whole dlq family: the list and the confirmed count', async () => {
    let listCalls = 0;
    let statsCalls = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/jobs/dlq`, () => {
        listCalls += 1;
        return HttpResponse.json(dlqRows(1));
      }),
      http.get(`${API_BASE}/api/v1/jobs/stats`, () => {
        statsCalls += 1;
        return statsWithDeadLetter(5);
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);
    await screen.findByText('5 jobs in dead-letter queue');
    const listBefore = listCalls;
    const statsBefore = statsCalls;

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => expect(listCalls).toBeGreaterThan(listBefore));
    await waitFor(() => expect(statsCalls).toBeGreaterThan(statsBefore));
  });

  it.each([0, 1])(
    'confirms max(stats count, visible rows) when stats reports %i but 3 rows are listed',
    async (statsCount) => {
      let purgeBody: Record<string, unknown> | undefined;
      server.use(
        // The list answers after the stats call so the stale-low count has already landed
        // by the time the rows (and the Purge All button) render.
        http.get(`${API_BASE}/api/v1/jobs/dlq`, async () => {
          await delay(100);
          return HttpResponse.json(dlqRows(3));
        }),
        http.get(`${API_BASE}/api/v1/jobs/stats`, () => statsWithDeadLetter(statsCount)),
        http.post(`${API_BASE}/api/v1/jobs/dlq/purge`, async ({ request }) => {
          purgeBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ purged_count: 3 });
        })
      );
      const user = userEvent.setup();
      render(<DeadLetterQueuePage />);

      await screen.findByText('3 jobs in dead-letter queue');
      await user.click(await screen.findByRole('button', { name: /purge all/i }));
      expect(await screen.findByText('3 job(s) will be permanently deleted')).toBeInTheDocument();
      await confirmPurge(user);

      await waitFor(() => expect(purgeBody).toBeDefined());
      expect(purgeBody).toMatchObject({ limit: 3, confirm: true });
      expect(purgeBody!.limit as number).toBeGreaterThanOrEqual(1);
    }
  );

  it('purges the queue and count captured when the dialog opened, not a later filter value', async () => {
    let purgeBody: Record<string, unknown> | undefined;
    const statsQueues: Array<string | null> = [];
    server.use(
      http.get(`${API_BASE}/api/v1/jobs/dlq`, async ({ request }) => {
        // Slower than stats, so a queue's count has landed before its rows render.
        await delay(100);
        const queue = new URL(request.url).searchParams.get('queue_name') ?? 'emails';
        return HttpResponse.json(dlqRows(queue === 'billing' ? 1 : 2, queue));
      }),
      http.get(`${API_BASE}/api/v1/jobs/stats`, ({ request }) => {
        const queue = new URL(request.url).searchParams.get('queue_name');
        statsQueues.push(queue);
        return statsWithDeadLetter(queue === 'billing' ? 2 : 5);
      }),
      http.post(`${API_BASE}/api/v1/jobs/dlq/purge`, async ({ request }) => {
        purgeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ purged_count: 5 });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterQueuePage />);
    const filter = await screen.findByPlaceholderText(/filter by queue/i);

    await user.type(filter, 'emails');
    // The filter is debounced; the table reloads once the "emails" queries start.
    await waitFor(() => expect(statsQueues).toContain('emails'), { timeout: 3000 });
    await user.click(await screen.findByRole('button', { name: /purge all/i }));
    expect(await screen.findByText(/dead-letter queue for "emails"/)).toBeInTheDocument();
    expect(screen.getByText('5 job(s) will be permanently deleted')).toBeInTheDocument();

    // The filter changes behind the open dialog (debounced value lands, counts reload).
    fireEvent.change(filter, { target: { value: 'billing' } });
    await waitFor(() => expect(statsQueues).toContain('billing'), { timeout: 3000 });
    await screen.findByText('2 jobs in dead-letter queue', undefined, { timeout: 3000 });

    // The dialog still describes what the user agreed to.
    expect(screen.getByText(/dead-letter queue for "emails"/)).toBeInTheDocument();
    expect(screen.queryByText(/dead-letter queue for "billing"/)).not.toBeInTheDocument();
    expect(screen.getByText('5 job(s) will be permanently deleted')).toBeInTheDocument();

    await confirmPurge(user);
    await waitFor(() => expect(purgeBody).toBeDefined());
    expect(purgeBody).toMatchObject({ queue_name: 'emails', limit: 5, confirm: true });
  });
});
