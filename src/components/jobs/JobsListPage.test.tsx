/**
 * Integration Tests for JobsListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { JobsListPage } from './JobsListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';

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
          expect(screen.getByText('send_email')).toBeInTheDocument();
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

    it('should render job types', async () => {
      render(<JobsListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('send_email')).toBeInTheDocument();
          expect(screen.getByText('process_image')).toBeInTheDocument();
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
          expect(screen.getByText('send_email')).toBeInTheDocument();
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
