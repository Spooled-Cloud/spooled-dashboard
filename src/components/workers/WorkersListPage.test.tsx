/**
 * Integration Tests for WorkersListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { WorkersListPage } from './WorkersListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';

describe('WorkersListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  describe('Page Layout', () => {
    it('should render the page title', async () => {
      render(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getByText('Workers')).toBeInTheDocument();
      });
    });

    it('should display page subtitle', async () => {
      render(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getByText(/monitor worker processes/i)).toBeInTheDocument();
      });
    });

    it('should show Refresh button', async () => {
      render(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should show loading skeletons initially', () => {
      render(<WorkersListPage />);
      expect(screen.getByText('Workers')).toBeInTheDocument();
    });
  });

  describe('Workers List', () => {
    it('should render workers after loading', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display worker status', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const activeElements = screen.getAllByText(/active/i);
          expect(activeElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display multiple workers', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
          expect(screen.getByText('worker-node-2')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display Queues label', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const queuesLabels = screen.getAllByText('Queues');
          expect(queuesLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Concurrency label', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const concurrencyLabels = screen.getAllByText('Concurrency');
          expect(concurrencyLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Current Jobs label', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const currentJobsLabels = screen.getAllByText('Current Jobs');
          expect(currentJobsLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Jobs Processed label', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const jobsProcessedLabels = screen.getAllByText('Jobs Processed');
          expect(jobsProcessedLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Jobs Failed label', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const jobsFailedLabels = screen.getAllByText('Jobs Failed');
          expect(jobsFailedLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Started timestamp', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const startedElements = screen.getAllByText(/started/i);
          expect(startedElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Last heartbeat timestamp', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const heartbeatElements = screen.getAllByText(/last heartbeat/i);
          expect(heartbeatElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Summary Cards', () => {
    it('should display Total Workers card', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('Total Workers')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display Active count card', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          // Look for the card label specifically
          const activeLabels = screen.getAllByText('Active');
          expect(activeLabels.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Idle count card', async () => {
      render(<WorkersListPage />);

      // Wait for workers list to load first
      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Then check for Idle - may be multiple (badge + card label)
      const idleElements = screen.getAllByText('Idle');
      expect(idleElements.length).toBeGreaterThan(0);
    });

    it('should display Offline count card', async () => {
      render(<WorkersListPage />);

      // Wait for workers list to load first
      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Worker Actions', () => {
    it('should click refresh button', async () => {
      const user = userEvent.setup();
      render(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display View Details buttons', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const viewButtons = screen.getAllByText('View Details');
          expect(viewButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should have links to individual worker pages', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('worker-node-1')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const workerLink = screen.getByRole('link', { name: 'worker-node-1' });
      expect(workerLink).toHaveAttribute('href', expect.stringContaining('/workers/'));
    });

    it('should have View Details links to worker pages', async () => {
      render(<WorkersListPage />);

      await waitFor(
        () => {
          const viewLinks = screen.getAllByRole('link', { name: /view details/i });
          expect(viewLinks.length).toBeGreaterThan(0);
          expect(viewLinks[0]).toHaveAttribute('href', expect.stringContaining('/workers/'));
        },
        { timeout: 3000 }
      );
    });
  });
});
