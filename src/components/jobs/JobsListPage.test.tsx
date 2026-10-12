/**
 * Integration Tests for JobsListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent, within } from '@/test/utils';
import { queryClient, queryKeys } from '@/lib/query-client';
import { resetHasMoreProbe } from '@/lib/api/jobs';
import { JobsListPage } from './JobsListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mockJobs } from '@/test/mocks/handlers';

describe('JobsListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  describe('Page Layout', () => {
    it('should render the page title', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Jobs')).toBeInTheDocument();
      });
    });

    it('should display page subtitle', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText(/manage and monitor/i)).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(<JobsListPage />);
      expect(screen.getByText('Jobs')).toBeInTheDocument();
    });

    it('should show Create Job button', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Job')).toBeInTheDocument();
      });
    });

    it('should show Refresh button', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('Jobs List', () => {
    it('should render jobs list after loading', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('job-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display job status badges', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          const completedElements = screen.getAllByText(/completed/i);
          expect(completedElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should render multiple job rows', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('job-1')).toBeInTheDocument();
          expect(screen.getByText('job-2')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display queue badges', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          // Check for queue names from mocks - may be multiple jobs in default queue
          const defaultElements = screen.getAllByText('default');
          expect(defaultElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display table headers', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('Job ID')).toBeInTheDocument();
          expect(screen.getByText('Type')).toBeInTheDocument();
          expect(screen.getByText('Queue')).toBeInTheDocument();
          expect(screen.getByText('Status')).toBeInTheDocument();
          expect(screen.getByText('Priority')).toBeInTheDocument();
          expect(screen.getByText('Attempt')).toBeInTheDocument();
          expect(screen.getByText('Created')).toBeInTheDocument();
          expect(screen.getByText('Actions')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display View action buttons', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          const viewButtons = screen.getAllByText('View');
          expect(viewButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Filters', () => {
    it('should have search input', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it('should display status filter options', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('All Statuses')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show pending status in filter options', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        const pendingElements = screen.getAllByText(/pending/i);
        expect(pendingElements.length).toBeGreaterThan(0);
      });
    });

    it('should have queue filter input', async () => {
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Queue...')).toBeInTheDocument();
      });
    });

    it('should type in search input', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test-job');

      expect(searchInput).toHaveValue('test-job');
    });

    it('should type in queue filter', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Queue...')).toBeInTheDocument();
      });

      const queueInput = screen.getByPlaceholderText('Queue...');
      await user.type(queueInput, 'emails');

      expect(queueInput).toHaveValue('emails');
    });

    it('should show clear button when filters are applied', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });
    });

    it('should clear filters when Clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Clear'));

      expect(searchInput).toHaveValue('');
    });

    it('should change status filter', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('All Statuses');
      await user.selectOptions(select, 'completed');

      expect(select).toHaveValue('completed');
    });
  });

  describe('Actions', () => {
    it('should click refresh button', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      await waitFor(
        () => {
          expect(screen.getByText('job-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should click on Create Job button', async () => {
      const user = userEvent.setup();
      render(<JobsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Job')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Job'));

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByText('Create New Job')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination info', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText(/showing/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should have Previous and Next buttons', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('Previous')).toBeInTheDocument();
          expect(screen.getByText('Next')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should disable Previous button on first page', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          const prevButton = screen.getByText('Previous');
          expect(prevButton).toBeDisabled();
        },
        { timeout: 3000 }
      );
    });
  });
});

describe('JobsListPage search debounce', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('does not fire one list request per keystroke while typing a search', async () => {
    let listCalls = 0;
    server.use(
      http.get('https://api.spooled.cloud/api/v1/jobs', () => {
        listCalls += 1;
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    render(<JobsListPage />);
    const input = await screen.findByPlaceholderText(/search/i);
    await waitFor(() => expect(listCalls).toBeGreaterThan(0));
    const before = listCalls;

    await user.type(input, 'abcdef');
    expect(listCalls).toBe(before);

    // Once typing pauses a single search scan runs for the final text.
    await waitFor(() => expect(listCalls).toBeGreaterThan(before), { timeout: 3000 });
  });
});

describe('JobsListPage exact total', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start from an empty cache and a clean URL
    // (earlier tests leave their filters in the query string).
    queryClient.clear();
    window.history.replaceState({}, '', '/jobs');
  });

  it('reads the total from a separate, slowly refreshed query that realtime invalidation leaves alone', async () => {
    let listCalls = 0;
    let statsCalls = 0;
    server.use(
      http.get('https://api.spooled.cloud/api/v1/jobs', () => {
        listCalls += 1;
        return HttpResponse.json([
          {
            id: 'job-1',
            queue_name: 'default',
            status: 'pending',
            priority: 0,
            attempt: 0,
            max_retries: 3,
            job_type: 'noop',
            created_at: '2024-01-01T00:00:00Z',
            scheduled_at: null,
            started_at: null,
            completed_at: null,
          },
        ]);
      }),
      http.get('https://api.spooled.cloud/api/v1/jobs/stats', () => {
        statsCalls += 1;
        return HttpResponse.json({
          total: 4321,
          pending: 4321,
          scheduled: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          deadletter: 0,
        });
      })
    );
    const user = userEvent.setup();
    render(<JobsListPage />);

    await screen.findByText('4321');
    expect(statsCalls).toBe(1);
    const listBefore = listCalls;

    // A realtime event invalidates the whole jobs family and the list refetches...
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    });
    await waitFor(() => expect(listCalls).toBeGreaterThan(listBefore));

    // ...and so does the Refresh button, but neither asks the backend for the count again.
    const listAfterEvent = listCalls;
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(listCalls).toBeGreaterThan(listAfterEvent));
    expect(statsCalls).toBe(1);
    expect(screen.getByText('4321')).toBeInTheDocument();
  });
});

describe('JobsListPage server-side filters', () => {
  const JOBS_URL = 'https://api.spooled.cloud/api/v1/jobs';

  /** Every GET /jobs query string the page sends, newest last. */
  let requests: URLSearchParams[] = [];
  const lastRequest = () => requests[requests.length - 1];

  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
    resetHasMoreProbe();
    window.history.replaceState({}, '', '/jobs');
    requests = [];
    server.use(
      http.get(JOBS_URL, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json([]);
      })
    );
  });

  it('offers every status but Failed: no job ever gets that status', async () => {
    render(<JobsListPage />);
    const select = await screen.findByLabelText('Status');
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'All Statuses',
      'Pending',
      'Scheduled',
      'Processing',
      'Completed',
      'Cancelled',
      'Dead Letter',
    ]);
    expect(within(select).queryByRole('option', { name: 'Failed' })).not.toBeInTheDocument();
  });

  it('opens a legacy ?status=failed link on the dead-letter jobs', async () => {
    window.history.replaceState({}, '', '/jobs?status=failed');
    render(<JobsListPage />);

    expect(await screen.findByLabelText('Status')).toHaveValue('deadletter');
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(lastRequest().get('status')).toBe('deadletter');
    expect(window.location.search).toContain('status=deadletter');
  });

  it('sends the status as one value', async () => {
    const user = userEvent.setup();
    render(<JobsListPage />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));

    await user.selectOptions(screen.getByLabelText('Status'), 'completed');

    await waitFor(() => expect(lastRequest().get('status')).toBe('completed'));
    expect(requests.filter((r) => r.get('status') === 'completed')).not.toHaveLength(0);
  });

  it('sends the search as q once typing pauses, never one request per keystroke', async () => {
    const user = userEvent.setup();
    render(<JobsListPage />);
    const input = await screen.findByPlaceholderText(/search/i);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const before = requests.length;

    await user.type(input, 'send_em');
    expect(requests.length).toBe(before);

    await waitFor(() => expect(lastRequest().get('q')).toBe('send_em'), { timeout: 3000 });
    // One search request; no client-side scan of further pages
    expect(requests.filter((r) => r.get('q') === 'send_em')).toHaveLength(1);
    expect(lastRequest().get('offset')).toBe('0');
    expect(window.location.search).toContain('search=send_em');
  });

  it('says what the search matches: id prefix, type or queue', async () => {
    render(<JobsListPage />);
    expect(await screen.findByPlaceholderText(/job id prefix, type or queue/i)).toBeInTheDocument();
  });

  it('sends the type, tag and queue filters to the server', async () => {
    const user = userEvent.setup();
    render(<JobsListPage />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));

    await user.type(screen.getByPlaceholderText('Type...'), 'send_email');
    await user.type(screen.getByPlaceholderText('Tag...'), 'urgent');
    await user.type(screen.getByPlaceholderText('Queue...'), 'emails');

    await waitFor(
      () => {
        expect(lastRequest().get('job_type')).toBe('send_email');
        expect(lastRequest().get('tag')).toBe('urgent');
        expect(lastRequest().get('queue_name')).toBe('emails');
      },
      { timeout: 3000 }
    );
    expect(window.location.search).toContain('tag=urgent');
    expect(window.location.search).toContain('job_type=send_email');
  });

  it('sends the created window as inclusive local days turned into UTC instants', async () => {
    render(<JobsListPage />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-10-05' } });

    await waitFor(() => {
      expect(lastRequest().get('created_after')).toBe(new Date(2026, 9, 1).toISOString());
      expect(lastRequest().get('created_before')).toBe(new Date(2026, 9, 6).toISOString());
    });
    expect(window.location.search).toContain('from=2026-10-01');
    expect(window.location.search).toContain('to=2026-10-05');
  });

  it('restores every filter from the URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/jobs?status=pending&queue=emails&job_type=send_email&search=abc&tag=urgent&from=2026-10-01&to=2026-10-05'
    );
    render(<JobsListPage />);

    expect(await screen.findByLabelText('Status')).toHaveValue('pending');
    expect(screen.getByPlaceholderText('Queue...')).toHaveValue('emails');
    expect(screen.getByPlaceholderText('Type...')).toHaveValue('send_email');
    expect(screen.getByPlaceholderText('Tag...')).toHaveValue('urgent');
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue('abc');
    expect(screen.getByLabelText('Created from')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Created to')).toHaveValue('2026-10-05');
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    const request = lastRequest();
    expect(request.get('status')).toBe('pending');
    expect(request.get('q')).toBe('abc');
    expect(request.get('tag')).toBe('urgent');
    expect(request.get('job_type')).toBe('send_email');
    expect(request.get('queue_name')).toBe('emails');
  });

  it('Clear drops every filter, including the new ones', async () => {
    window.history.replaceState({}, '', '/jobs?tag=urgent&job_type=x&from=2026-10-01');
    const user = userEvent.setup();
    render(<JobsListPage />);
    await user.click(await screen.findByText('Clear'));

    expect(screen.getByPlaceholderText('Tag...')).toHaveValue('');
    expect(screen.getByPlaceholderText('Type...')).toHaveValue('');
    expect(screen.getByLabelText('Created from')).toHaveValue('');
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  describe('exact total from GET /jobs/stats', () => {
    let statsCalls = 0;
    beforeEach(() => {
      statsCalls = 0;
      server.use(
        http.get('https://api.spooled.cloud/api/v1/jobs/stats', () => {
          statsCalls += 1;
          return HttpResponse.json({ total: 5000, pending: 5000, deadletter: 0 });
        })
      );
    });

    it('is asked for an unfiltered list, and within a queue or one status', async () => {
      window.history.replaceState({}, '', '/jobs?queue=emails&status=pending');
      render(<JobsListPage />);
      await waitFor(() => expect(statsCalls).toBe(1));
    });

    it.each([
      ['a search', '?search=abc'],
      ['a job type', '?job_type=send_email'],
      ['a tag', '?tag=urgent'],
      ['a start date', '?from=2026-10-01'],
      ['an end date', '?to=2026-10-05'],
    ])('is not asked for with %s: stats cannot count it', async (_name, query) => {
      window.history.replaceState({}, '', `/jobs${query}`);
      render(<JobsListPage />);
      await waitFor(() => expect(requests.length).toBeGreaterThan(0));
      // Give a (wrongly) enabled stats query time to fire
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(statsCalls).toBe(0);
    });
  });

  describe('paging with X-Has-More', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `page-job-${i}`,
      queue_name: 'default',
      status: 'completed',
      priority: 0,
      attempt: 0,
      max_retries: 3,
      job_type: 'noop',
      created_at: mockJobs[0].created_at,
    }));

    it('enables Next when the header says more follow', async () => {
      window.history.replaceState({}, '', '/jobs?search=page');
      const forty = Array.from({ length: 40 }, (_, i) => ({ ...rows[0], id: `page-job-${i}` }));
      server.use(
        http.get(JOBS_URL, ({ request }) => {
          const url = new URL(request.url);
          const limit = Number(url.searchParams.get('limit'));
          const offset = Number(url.searchParams.get('offset'));
          return HttpResponse.json(forty.slice(offset, offset + limit), {
            headers: { 'X-Has-More': String(forty.length > offset + limit) },
          });
        })
      );
      render(<JobsListPage />);
      expect(await screen.findByText('page-job-0')).toBeInTheDocument();
      expect(screen.getByText('page-job-24')).toBeInTheDocument();
      expect(screen.queryByText('page-job-25')).not.toBeInTheDocument();
      expect(screen.getByText('Next').closest('button')).toBeEnabled();
    });

    it('disables Next on the last page when the header says nothing follows', async () => {
      window.history.replaceState({}, '', '/jobs?search=page');
      // The first response (probe) teaches the page the header is readable; every response
      // after it asks for exactly a page.
      server.use(
        http.get(JOBS_URL, ({ request }) => {
          const limit = Number(new URL(request.url).searchParams.get('limit'));
          return HttpResponse.json(rows.slice(0, limit), {
            headers: { 'X-Has-More': String(rows.length > limit) },
          });
        })
      );
      render(<JobsListPage />);
      expect(await screen.findByText('page-job-0')).toBeInTheDocument();
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      });
      await waitFor(() => expect(screen.getByText('Next').closest('button')).toBeDisabled());
      expect(screen.getByText('page-job-24')).toBeInTheDocument();
    });

    it('still pages by probing when the browser cannot read the header', async () => {
      // A tag works on every server version, so the headerless rows are still the results.
      window.history.replaceState({}, '', '/jobs?tag=page');
      const extra = [...rows, { ...rows[0], id: 'page-job-25' }];
      server.use(
        http.get(JOBS_URL, ({ request }) => {
          const limit = Number(new URL(request.url).searchParams.get('limit'));
          return HttpResponse.json(extra.slice(0, limit));
        })
      );
      render(<JobsListPage />);
      expect(await screen.findByText('page-job-0')).toBeInTheDocument();
      // 26 rows came back for a page of 25: a next page exists, and its row is not shown
      expect(screen.getByText('Next').closest('button')).toBeEnabled();
      expect(screen.queryByText('page-job-25')).not.toBeInTheDocument();
    });
  });

  describe('pagination without an exact total', () => {
    const forty = Array.from({ length: 40 }, (_, i) => ({
      id: `page-job-${i}`,
      queue_name: 'default',
      status: 'completed',
      priority: 0,
      attempt: 0,
      max_retries: 3,
      job_type: 'noop',
      created_at: mockJobs[0].created_at,
    }));
    let statsCalls = 0;

    /** A 0.1.122 backend with 40 matching rows: pages by offset and sends X-Has-More. */
    const useBackendWith40Rows = () => {
      server.use(
        http.get(JOBS_URL, ({ request }) => {
          const url = new URL(request.url);
          const limit = Number(url.searchParams.get('limit'));
          const offset = Number(url.searchParams.get('offset'));
          return HttpResponse.json(forty.slice(offset, offset + limit), {
            headers: { 'X-Has-More': String(forty.length > offset + limit) },
          });
        })
      );
    };

    beforeEach(() => {
      statsCalls = 0;
      server.use(
        http.get('https://api.spooled.cloud/api/v1/jobs/stats', () => {
          statsCalls += 1;
          return HttpResponse.json({ total: 40, pending: 0, completed: 40, deadletter: 0 });
        })
      );
    });

    it.each([
      ['a search', '?search=page'],
      ['a job type', '?job_type=noop'],
      ['a tag', '?tag=page'],
      ['a start date', '?from=2020-01-01'],
      ['an end date', '?to=2099-01-01'],
    ])(
      'with %s it shows the range and the page, never a guessed total, and pages by hasMore',
      async (_name, query) => {
        window.history.replaceState({}, '', `/jobs${query}`);
        useBackendWith40Rows();
        const user = userEvent.setup();
        render(<JobsListPage />);

        expect(await screen.findByText('Showing 1–25')).toBeInTheDocument();
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        // 26 (rows seen + 1) and 2 (pages seen + 1) are floors, not counts
        expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/page 1 of/i)).not.toBeInTheDocument();
        expect(screen.getByText('Next').closest('button')).toBeEnabled();

        await user.click(screen.getByText('Next'));

        expect(await screen.findByText('Showing 26–40')).toBeInTheDocument();
        expect(screen.getByText('Page 2')).toBeInTheDocument();
        expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
        // The header on this page says nothing follows
        await waitFor(() => expect(screen.getByText('Next').closest('button')).toBeDisabled());
        expect(screen.getByText('Previous').closest('button')).toBeEnabled();
        expect(statsCalls).toBe(0);
      }
    );

    it('prints the exact count once /jobs/stats has answered for an unfiltered view', async () => {
      useBackendWith40Rows();
      render(<JobsListPage />);

      expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
      expect(screen.getByText(/results/i).textContent).toBe('Showing 1 to 25 of 40 results');
      expect(screen.queryByText('Showing 1–25')).not.toBeInTheDocument();
    });

    it('does not guess when the count of an unfiltered view cannot be read', async () => {
      useBackendWith40Rows();
      server.use(
        http.get('https://api.spooled.cloud/api/v1/jobs/stats', () =>
          HttpResponse.json({ message: 'boom' }, { status: 500 })
        )
      );
      render(<JobsListPage />);

      expect(await screen.findByText('Showing 1–25')).toBeInTheDocument();
      expect(screen.getByText('Page 1')).toBeInTheDocument();
      expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
      expect(screen.getByText('Next').closest('button')).toBeEnabled();
    });
  });

  describe('a server that cannot filter by search, type or date', () => {
    const NOTICE = 'This server version cannot filter by search, type or date yet';
    /** Backend 0.1.121: ignores q, job_type and the created window; no X-Has-More either. */
    const useOldBackend = () => {
      server.use(
        http.get(JOBS_URL, ({ request }) => {
          requests.push(new URL(request.url).searchParams);
          return HttpResponse.json(
            Array.from({ length: 25 }, (_, i) => ({
              id: `unfiltered-${i}`,
              queue_name: 'default',
              status: 'completed',
              priority: 0,
              attempt: 0,
              max_retries: 3,
              job_type: 'noop',
              created_at: mockJobs[0].created_at,
            }))
          );
        })
      );
    };

    it.each([
      ['a search', '?search=send_email'],
      ['a job type', '?job_type=send_email'],
      ['a start date', '?from=2026-10-01'],
      ['an end date', '?to=2026-10-05'],
    ])('with %s it shows the notice instead of the unfiltered rows', async (_name, query) => {
      window.history.replaceState({}, '', `/jobs${query}`);
      useOldBackend();
      render(<JobsListPage />);

      expect(await screen.findByText(NOTICE)).toBeInTheDocument();
      expect(screen.queryByText('unfiltered-0')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText('No jobs found')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
      expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();
    });

    it('lets the user clear the filters to get the list back', async () => {
      window.history.replaceState({}, '', '/jobs?search=send_email');
      useOldBackend();
      const user = userEvent.setup();
      render(<JobsListPage />);
      await screen.findByText(NOTICE);

      await user.click(screen.getByText('Clear'));

      expect(await screen.findByText('unfiltered-0')).toBeInTheDocument();
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });

    it.each([
      ['a queue', '?queue=default'],
      ['a status', '?status=completed'],
      ['a tag', '?tag=urgent'],
      ['no filter', ''],
    ])('still lists the jobs for %s', async (_name, query) => {
      window.history.replaceState({}, '', `/jobs${query}`);
      useOldBackend();
      render(<JobsListPage />);

      expect(await screen.findByText('unfiltered-0')).toBeInTheDocument();
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });

    it('shows no notice when the server applies the filters (it sends X-Has-More)', async () => {
      window.history.replaceState({}, '', '/jobs?search=nothing-matches');
      server.use(
        http.get(JOBS_URL, () => HttpResponse.json([], { headers: { 'X-Has-More': 'false' } }))
      );
      render(<JobsListPage />);

      expect(await screen.findByText('No jobs found')).toBeInTheDocument();
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });
  });
});
