/**
 * Tests for the dashboard dead-letter action bar: Retry all and Purge both ask first, show
 * the real count and send exactly that many rows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { mockDashboard } from '@/test/mocks/handlers';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { DeadLetterActionBar } from './DashboardHomeEnhanced';

const API_BASE = 'https://api.spooled.cloud';

function dashboardWithDeadLetter(deadletter: number) {
  return http.get(`${API_BASE}/api/v1/dashboard`, () =>
    HttpResponse.json({ ...mockDashboard, jobs: { ...mockDashboard.jobs, deadletter } })
  );
}

describe('DeadLetterActionBar', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('asks before retrying, shows the real count and sends it as the limit', async () => {
    let retryBody: Record<string, unknown> | undefined;
    server.use(
      dashboardWithDeadLetter(40),
      http.post(`${API_BASE}/api/v1/jobs/dlq/retry`, async ({ request }) => {
        retryBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ retried_count: 40, retried_jobs: [] });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterActionBar />);

    await user.click(await screen.findByRole('button', { name: /retry all/i }));

    // Nothing is sent until the dialog is confirmed
    expect(
      await screen.findByText(
        'This will move 40 job(s) back to their queues for another retry attempt.'
      )
    ).toBeInTheDocument();
    expect(retryBody).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /^retry$/i }));
    await waitFor(() => expect(retryBody).toBeDefined());
    expect(retryBody).toEqual({ limit: 40 });
  });

  it('caps a retry at the backend limit of 100 and says how many are left', async () => {
    let retryBody: Record<string, unknown> | undefined;
    server.use(
      dashboardWithDeadLetter(4800),
      http.post(`${API_BASE}/api/v1/jobs/dlq/retry`, async ({ request }) => {
        retryBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ retried_count: 100, retried_jobs: [] });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterActionBar />);

    await user.click(await screen.findByRole('button', { name: /retry all/i }));

    expect(await screen.findByText(/move 100 job\(s\) back/i)).toBeInTheDocument();
    expect(screen.getByText(/only 100 of 4800 can be retried per request/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^retry$/i }));
    await waitFor(() => expect(retryBody).toBeDefined());
    expect(retryBody).toEqual({ limit: 100 });
  });

  it('does not retry when the dialog is cancelled', async () => {
    const retry = vi.fn();
    server.use(
      dashboardWithDeadLetter(40),
      http.post(`${API_BASE}/api/v1/jobs/dlq/retry`, () => {
        retry();
        return HttpResponse.json({ retried_count: 0, retried_jobs: [] });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterActionBar />);

    await user.click(await screen.findByRole('button', { name: /retry all/i }));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByText(/move 40 job\(s\)/i)).not.toBeInTheDocument());
    expect(retry).not.toHaveBeenCalled();
  });

  it('purges only after typing PURGE and sends the confirmed count as limit', async () => {
    let purgeBody: Record<string, unknown> | undefined;
    const confirmSpy = vi.spyOn(window, 'confirm');
    server.use(
      dashboardWithDeadLetter(4800),
      http.post(`${API_BASE}/api/v1/jobs/dlq/purge`, async ({ request }) => {
        purgeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ purged_count: 4800 });
      })
    );
    const user = userEvent.setup();
    render(<DeadLetterActionBar />);

    await user.click(await screen.findByRole('button', { name: /^purge$/i }));
    expect(await screen.findByText('4800 job(s) will be permanently deleted')).toBeInTheDocument();

    const confirmButton = screen.getAllByRole('button', { name: /^purge$/i }).at(-1)!;
    expect(confirmButton).toBeDisabled();
    expect(purgeBody).toBeUndefined();

    await user.type(screen.getByRole('textbox'), 'PURGE');
    await user.click(confirmButton);

    await waitFor(() => expect(purgeBody).toBeDefined());
    expect(purgeBody).toEqual({ limit: 4800, confirm: true });
    // The typed dialog replaced the native window.confirm
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('caps a purge at the backend limit of 10000 and warns', async () => {
    server.use(dashboardWithDeadLetter(25000));
    const user = userEvent.setup();
    render(<DeadLetterActionBar />);

    await user.click(await screen.findByRole('button', { name: /^purge$/i }));

    expect(await screen.findByText('10000 job(s) will be permanently deleted')).toBeInTheDocument();
    expect(screen.getByText(/only 10000 of 25000 can be purged per request/i)).toBeInTheDocument();
  });

  it('shows no actions when the dead-letter queue is empty', async () => {
    server.use(dashboardWithDeadLetter(0));
    render(<DeadLetterActionBar />);

    await screen.findByText('Dead-letter queue');
    expect(screen.queryByRole('button', { name: /retry all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^purge$/i })).not.toBeInTheDocument();
  });
});
