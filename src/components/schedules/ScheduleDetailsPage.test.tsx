import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { ScheduleDetailsPage } from './ScheduleDetailsPage';

const API_BASE = 'https://api.spooled.cloud';

describe('ScheduleDetailsPage execution history', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start every test from an empty cache.
    queryClient.clear();
  });

  it('shows pending and running runs as in progress, not as success or failure', async () => {
    render(<ScheduleDetailsPage scheduleId="schedule-1" />);

    const pending = await screen.findByTestId('schedule-run-run-pending');
    expect(within(pending).getByRole('img', { name: 'Run pending' })).toBeInTheDocument();
    expect(within(pending).getByText('Pending')).toBeInTheDocument();
    expect(within(pending).queryByRole('img', { name: 'Run completed' })).not.toBeInTheDocument();
    expect(within(pending).queryByRole('img', { name: 'Run failed' })).not.toBeInTheDocument();

    const running = screen.getByTestId('schedule-run-run-running');
    expect(within(running).getByRole('img', { name: 'Run running' })).toBeInTheDocument();
    expect(within(running).getByText('Running')).toBeInTheDocument();
    // The spinner class must be its own token, not glued to the colour class.
    const spinner = within(running).getByRole('img', { name: 'Run running' });
    expect(spinner.querySelector('svg')?.getAttribute('class')?.split(/\s+/)).toContain(
      'animate-spin'
    );
    expect(within(running).queryByRole('img', { name: 'Run completed' })).not.toBeInTheDocument();
    expect(within(running).queryByRole('img', { name: 'Run failed' })).not.toBeInTheDocument();
  });

  it('keeps completed and failed runs as they were', async () => {
    render(<ScheduleDetailsPage scheduleId="schedule-1" />);

    const completed = await screen.findByTestId('schedule-run-run-completed');
    expect(within(completed).getByRole('img', { name: 'Run completed' })).toBeInTheDocument();
    // Only runs in flight carry a text label
    expect(within(completed).queryByText('Completed')).not.toBeInTheDocument();

    const failed = screen.getByTestId('schedule-run-run-failed');
    expect(within(failed).getByRole('img', { name: 'Run failed' })).toBeInTheDocument();
    expect(within(failed).getByText('handler exploded')).toBeInTheDocument();

    const notEnqueued = screen.getByTestId('schedule-run-run-not-enqueued');
    expect(within(notEnqueued).getByRole('img', { name: 'Run failed' })).toBeInTheDocument();
    expect(within(notEnqueued).getByText('No job created')).toBeInTheDocument();
    expect(within(notEnqueued).getByText('plan limit reached')).toBeInTheDocument();
  });

  it('links each run to its job and shows the job status only when it adds something', async () => {
    render(<ScheduleDetailsPage scheduleId="schedule-1" />);

    const failed = await screen.findByTestId('schedule-run-run-failed');
    expect(within(failed).getByRole('link')).toHaveAttribute('href', '/jobs/job-failed-00001');
    // run failed, job in the dead-letter queue
    expect(within(failed).getByText('Job: deadletter')).toBeInTheDocument();

    // These job statuses only repeat the run state
    for (const id of ['run-pending', 'run-running', 'run-completed']) {
      expect(within(screen.getByTestId(`schedule-run-${id}`)).queryByText(/^Job: /)).toBeNull();
    }
  });

  it('shows a run as in progress when an older backend wrote completed for a pending job', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/schedules/:id/history`, () =>
        HttpResponse.json([
          {
            id: 'run-old',
            schedule_id: 'schedule-1',
            job_id: 'job-old-0000001',
            status: 'completed',
            job_status: 'pending',
            error_message: null,
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:00:00Z',
          },
        ])
      )
    );
    render(<ScheduleDetailsPage scheduleId="schedule-1" />);

    const run = await screen.findByTestId('schedule-run-run-old');
    expect(within(run).getByRole('img', { name: 'Run pending' })).toBeInTheDocument();
    expect(within(run).queryByRole('img', { name: 'Run completed' })).not.toBeInTheDocument();
  });

  it('says so when there is no history yet', async () => {
    server.use(http.get(`${API_BASE}/api/v1/schedules/:id/history`, () => HttpResponse.json([])));
    render(<ScheduleDetailsPage scheduleId="schedule-1" />);

    expect(await screen.findByText('No execution history yet')).toBeInTheDocument();
  });
});
