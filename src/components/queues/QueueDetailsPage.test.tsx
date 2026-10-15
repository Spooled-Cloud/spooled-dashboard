import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { QueueDetailsPage } from './QueueDetailsPage';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';

const config = (maxRetries: number) => ({
  id: 'q1',
  organization_id: 'org-1',
  queue_name: 'default',
  max_retries: maxRetries,
  default_timeout: 30,
  rate_limit: null,
  enabled: true,
  settings: { concurrency: 2, retry_delay_ms: 30000 },
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

describe('QueueDetailsPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('does not show settings the backend does not enforce', async () => {
    render(<QueueDetailsPage queueName="default" />);
    await screen.findByText('Max Retries');

    expect(screen.queryByText('Concurrency')).not.toBeInTheDocument();
    expect(screen.queryByText('Retry Delay (ms)')).not.toBeInTheDocument();
    expect(screen.queryByText('Backoff Multiplier')).not.toBeInTheDocument();
    expect(screen.queryByText('Max Retry Delay (ms)')).not.toBeInTheDocument();
  });

  it('shows the backend dead-letter count in the health strip', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
        HttpResponse.json({
          queue_name: params.name,
          pending_jobs: 1,
          processing_jobs: 0,
          completed_jobs_24h: 5,
          failed_jobs_24h: 3,
          deadletter_jobs: 42,
          avg_processing_time_ms: 100,
          max_job_age_seconds: 1,
          active_workers: 1,
        })
      )
    );
    render(<QueueDetailsPage queueName="default" />);
    expect(await screen.findByText('Dead Letter')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  it('shows a dash for the dead-letter count when the backend does not report it', async () => {
    // The page uses the app-wide query client; drop the previous test's cached stats.
    queryClient.clear();
    server.use(
      http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
        HttpResponse.json({
          queue_name: params.name,
          pending_jobs: 1,
          processing_jobs: 0,
          completed_jobs_24h: 5,
          failed_jobs_24h: 3,
          avg_processing_time_ms: 100,
          max_job_age_seconds: 1,
          active_workers: 1,
        })
      )
    );
    render(<QueueDetailsPage queueName="default" />);
    const label = await screen.findByText('Dead Letter');
    const value = label.previousElementSibling;
    expect(value).not.toBeNull();
    expect(value).toHaveTextContent('—');
    expect(value).not.toHaveTextContent('0');
  });

  it('counts workers from the stats endpoint, which includes multi-queue workers', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workers`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
        HttpResponse.json({
          queue_name: params.name,
          pending_jobs: 0,
          processing_jobs: 0,
          completed_jobs_24h: 0,
          failed_jobs_24h: 0,
          deadletter_jobs: 0,
          active_workers: 2,
        })
      )
    );
    render(<QueueDetailsPage queueName="default" />);
    await screen.findByText('Capacity');
    await waitFor(() => expect(screen.getByText('/ 2')).toBeInTheDocument());
    expect(screen.queryByText('No Workers')).not.toBeInTheDocument();
  });

  it('edits max retries of 0 as 0 and sends only retries and timeout', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.get(`${API_BASE}/api/v1/queues/:name`, () => HttpResponse.json(config(0))),
      http.put(`${API_BASE}/api/v1/queues/:name/config`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(config(0));
      })
    );
    const user = userEvent.setup();
    render(<QueueDetailsPage queueName="default" />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const inputs = await screen.findAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(0);

    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(body.queue_name).toBe('default'));
    expect(body.max_retries).toBe(0);
    expect(body.settings).toBeUndefined();
  });

  it('does not save a job timeout that is not a whole number of seconds', async () => {
    let puts = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/queues/:name`, () => HttpResponse.json(config(3))),
      http.put(`${API_BASE}/api/v1/queues/:name/config`, () => {
        puts += 1;
        return HttpResponse.json(config(3));
      })
    );
    vi.mocked(toast.error).mockClear();
    const user = userEvent.setup();
    render(<QueueDetailsPage queueName="default" />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    const inputs = await screen.findAllByRole('spinbutton');
    await user.clear(inputs[1]!);
    await user.type(inputs[1]!, '1500');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(puts).toBe(0);
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).toMatch(/whole number of seconds/);
  });
});
