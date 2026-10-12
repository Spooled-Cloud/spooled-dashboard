/**
 * Integration Tests for JobsListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@/test/utils';
import { queryClient, queryKeys } from '@/lib/query-client';
import { JobsListPage } from './JobsListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

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
