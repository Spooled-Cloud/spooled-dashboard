import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as plainRender, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { render, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { JobDetailsPage, JsonDisplay } from './JobDetailsPage';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

describe('JsonDisplay', () => {
  it('renders non-object JSON instead of "No payload available"', () => {
    plainRender(<JsonDisplay data="hello" title="Payload" />);
    expect(screen.getByText('"hello"')).toBeInTheDocument();
    expect(screen.queryByText(/No payload available/i)).not.toBeInTheDocument();
  });

  it('renders false, 0, and empty array payloads', () => {
    const { rerender } = plainRender(<JsonDisplay data={false} title="Payload" />);
    expect(screen.getByText('false')).toBeInTheDocument();

    rerender(<JsonDisplay data={0} title="Payload" />);
    expect(screen.getByText('0')).toBeInTheDocument();

    rerender(<JsonDisplay data={[]} title="Payload" />);
    expect(screen.getByText('[]')).toBeInTheDocument();
  });

  it('still treats an empty object as missing', () => {
    plainRender(<JsonDisplay data={{}} title="Payload" />);
    expect(screen.getByText(/No payload available/i)).toBeInTheDocument();
  });

  it('shows Copied! after a successful copy', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    plainRender(<JsonDisplay data={{ a: 1 }} title="Payload" />);
    await user.click(screen.getByRole('button', { name: /copy/i }));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ a: 1 }, null, 2));
  });

  it('tells the user when the clipboard is blocked instead of an unhandled rejection', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    vi.mocked(toast.error).mockClear();
    plainRender(<JsonDisplay data={{ a: 1 }} title="Payload" />);
    await user.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/could not copy/i);
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
  });
});

describe('JobDetailsPage actions', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('offers no Delete on a completed job (DELETE /jobs/{id} only cancels)', async () => {
    render(<JobDetailsPage jobId="job-1" />);
    await waitFor(() => expect(screen.getAllByText(/completed/i).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('keeps Cancel for a pending job and still offers no Delete', async () => {
    render(<JobDetailsPage jobId="job-2" />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /cancel/i }).length).toBeGreaterThan(0)
    );
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows the backend message when a retry is refused by the workflow limit', async () => {
    server.use(
      http.post('https://api.spooled.cloud/api/v1/jobs/:id/retry', () =>
        HttpResponse.json(
          { code: 'LIMIT_EXCEEDED', message: 'Workflow limit reached (5/5)' },
          { status: 429 }
        )
      )
    );
    const user = userEvent.setup();
    render(<JobDetailsPage jobId="job-3" />);
    const retry = await screen.findAllByRole('button', { name: /^retry/i });
    await user.click(retry[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][1]).toMatchObject({
      description: 'Workflow limit reached (5/5)',
    });
  });
});

describe('JobDetailsPage timeline from GET /jobs/{id}/history', () => {
  const HISTORY_URL = 'https://api.spooled.cloud/api/v1/jobs/:id/history';

  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start every test from an empty cache.
    queryClient.clear();
    vi.mocked(toast.error).mockClear();
  });

  it('shows each recorded event with its worker and a summary of its details', async () => {
    render(<JobDetailsPage jobId="job-1" />);

    const timeline = await screen.findByTestId('job-timeline');
    // processing -> retry_scheduled -> processing -> completed, after the job's own Created
    await waitFor(() => expect(within(timeline).getByText('Retry scheduled')).toBeInTheDocument());
    const labels = within(timeline)
      .getAllByText(/^(Created|Started|Retry scheduled|Completed)$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(['Created', 'Started', 'Retry scheduled', 'Started', 'Completed']);

    // The retry row: which retry, when the next run was due, and the error
    expect(
      within(timeline).getByText(/^retry 1 · next run .+ · error: Connection refused$/)
    ).toBeInTheDocument();
    // The worker links to its page; ids that explain nothing (lease, organization) are hidden
    const workerLinks = within(timeline).getAllByRole('link', { name: 'worker-1' });
    expect(workerLinks[0]).toHaveAttribute('href', '/workers/worker-1');
    const worker2Links = within(timeline).getAllByRole('link', { name: 'worker-2' });
    expect(worker2Links).toHaveLength(2);
    expect(worker2Links[0]).toHaveAttribute('href', '/workers/worker-2');
    expect(within(timeline).queryByText(/lease-1/)).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/org-1/)).not.toBeInTheDocument();
  });

  it('asks for the first 100 events', async () => {
    let seen: URLSearchParams | undefined;
    server.use(
      http.get(HISTORY_URL, ({ request }) => {
        seen = new URL(request.url).searchParams;
        return HttpResponse.json([]);
      })
    );
    render(<JobDetailsPage jobId="job-1" />);
    await waitFor(() => expect(seen).toBeDefined());
    expect(seen?.get('limit')).toBe('100');
  });

  it('falls back to the job fields, quietly, on a backend without the route (404)', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({ code: 'NOT_FOUND', message: 'Not Found' }, { status: 404 })
      )
    );
    render(<JobDetailsPage jobId="job-1" />);

    const timeline = await screen.findByTestId('job-timeline');
    await waitFor(() => expect(within(timeline).getByText('Completed')).toBeInTheDocument());
    expect(within(timeline).getByText('Created')).toBeInTheDocument();
    expect(within(timeline).queryByText('Retry scheduled')).not.toBeInTheDocument();
    // No error text, no toast
    expect(within(timeline).queryByText(/could not be loaded/i)).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('falls back to the job fields for a job without recorded events', async () => {
    render(<JobDetailsPage jobId="job-2" />);
    const timeline = await screen.findByTestId('job-timeline');
    await waitFor(() => expect(within(timeline).getByText('Created')).toBeInTheDocument());
    expect(within(timeline).queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });

  it('shows the job fields and a one-line note when the history fails to load', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json({ code: 'DATABASE_ERROR', message: 'boom' }, { status: 500 })
      )
    );
    render(<JobDetailsPage jobId="job-1" />);

    const timeline = await screen.findByTestId('job-timeline');
    expect(
      await within(timeline).findByText(/recorded events could not be loaded/i)
    ).toBeInTheDocument();
    expect(within(timeline).getByText('Created')).toBeInTheDocument();
    expect(within(timeline).getByText('Completed')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so when the history was cut at the page limit', async () => {
    server.use(
      http.get(HISTORY_URL, () =>
        HttpResponse.json(
          [
            {
              id: 'h1',
              job_id: 'job-1',
              event_type: 'processing',
              worker_id: 'worker-1',
              details: {},
              created_at: '2024-01-01T00:00:10Z',
            },
          ],
          { headers: { 'X-Has-More': 'true' } }
        )
      )
    );
    render(<JobDetailsPage jobId="job-1" />);
    expect(await screen.findByText('Showing the first 100 recorded events.')).toBeInTheDocument();
  });
});
