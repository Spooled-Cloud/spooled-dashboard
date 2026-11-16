/**
 * The jobs list does not strand the user on an empty later page once the rows behind it
 * drain (workers claim jobs while page 2 is open and the 10 s poll refetches it).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, act, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient, queryKeys } from '@/lib/query-client';
import { resetHasMoreProbe } from '@/lib/api/jobs';
import { JobsListPage } from './JobsListPage';

const JOBS_URL = 'https://api.spooled.cloud/api/v1/jobs';

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `job-${String(i).padStart(4, '0')}`,
    queue_name: 'emails',
    status: 'pending',
    priority: 0,
    attempt: 0,
    max_retries: 3,
    job_type: 'noop',
    last_error: null,
    created_at: '2026-11-16T10:00:00Z',
  }));
}

describe('JobsListPage after the open page drains', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    resetHasMoreProbe();
    window.history.replaceState({}, '', '/jobs?status=pending');
  });

  it('steps back to the last page with jobs instead of "No jobs found" without a pager', async () => {
    let pending = rows(40);
    server.use(
      http.get(JOBS_URL, ({ request }) => {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get('limit'));
        const offset = Number(url.searchParams.get('offset'));
        return HttpResponse.json(pending.slice(offset, offset + limit), {
          headers: { 'X-Has-More': String(pending.length > offset + limit) },
        });
      }),
      http.get(`${JOBS_URL}/stats`, () =>
        HttpResponse.json({ total: pending.length, pending: pending.length })
      )
    );
    const user = userEvent.setup();
    render(<JobsListPage />);
    await screen.findByText('Next');
    await user.click(screen.getByText('Next'));
    await screen.findByText('job-0025');

    // Workers claim 20 jobs; the poll refetches page 2, which is now empty.
    pending = rows(20);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    });

    expect(await screen.findByText('job-0000')).toBeInTheDocument();
    expect(screen.getByText('job-0019')).toBeInTheDocument();
    expect(screen.queryByText('No jobs found')).not.toBeInTheDocument();
  });
});
