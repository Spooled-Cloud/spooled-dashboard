/**
 * Deregister and Delete queue say what the backend does. Deregister only marks the worker
 * offline (a running worker's next heartbeat revives it), and deleting a queue without its jobs
 * removes only the configuration, refused only while pending, scheduled or processing jobs exist.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { WorkersListPage } from './WorkersListPage';
import { WorkerDetailsPage } from './WorkerDetailsPage';
import { QueueDetailsPage } from '@/components/queues/QueueDetailsPage';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const API_BASE = 'https://api.spooled.cloud';

describe('Deregister worker texts', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
    vi.mocked(toast.success).mockClear();
  });

  it('warns that deregistering does not stop the process and reports "marked offline"', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workers`, () =>
        HttpResponse.json([
          {
            id: 'w-1',
            queue_name: 'default',
            hostname: 'idle-host',
            status: 'healthy',
            current_jobs: 0,
            max_concurrency: 4,
            last_heartbeat: '2026-11-16T10:00:00Z',
          },
        ])
      ),
      http.post(
        `${API_BASE}/api/v1/workers/:id/deregister`,
        () => new HttpResponse(null, { status: 204 })
      )
    );
    const user = userEvent.setup();
    render(<WorkersListPage />);

    await user.click(await screen.findByRole('button', { name: 'Deregister idle-host' }));
    expect(
      await screen.findByText(/only marks the worker offline; it does not stop the worker process/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/next heartbeat shows it online again/i)).toBeInTheDocument();
    expect(screen.queryByText(/will stop receiving new jobs/i)).not.toBeInTheDocument();

    const confirm = screen.getAllByRole('button', { name: /^deregister$/i });
    await user.click(confirm[confirm.length - 1]);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Worker marked offline', expect.anything())
    );
    expect(toast.success).not.toHaveBeenCalledWith('Worker deregistered', expect.anything());
  });

  it('asks on the worker page without claiming the worker stops processing jobs', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<WorkerDetailsPage workerId="worker-1" />);

    const buttons = await screen.findAllByRole('button', { name: /deregister/i });
    await user.click(buttons[0]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const text = confirmSpy.mock.calls[0][0] as string;
    expect(text).toMatch(/does not stop the worker process/);
    expect(text).not.toMatch(/stop it from processing jobs/);
    confirmSpy.mockRestore();
  });
});

describe('Delete queue texts', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('says only the configuration goes and which jobs block it, not that the queue must be empty', async () => {
    const user = userEvent.setup();
    render(<QueueDetailsPage queueName="default" />);

    await user.click(await screen.findByRole('button', { name: /delete queue/i }));
    expect(
      await screen.findByText(/only the queue configuration \(settings, pause state\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/refused while the queue has pending, scheduled or processing jobs/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/queue must be empty/i)).not.toBeInTheDocument();
  });
});
