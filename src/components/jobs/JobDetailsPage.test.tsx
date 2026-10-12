import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as plainRender, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { server } from '@/test/mocks/server';
import { render, waitFor, mockAuthenticatedState } from '@/test/utils';
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
