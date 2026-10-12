/**
 * Integration Tests for WorkersListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { WorkersListPage } from './WorkersListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { mockWorkersSummary, withoutWorkerCounters } from '@/test/mocks/handlers';

describe('WorkersListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start every test from an empty cache.
    queryClient.clear();
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

    it('shows the processed and failed counters the backend sends (0.1.122)', async () => {
      render(<WorkersListPage />);

      expect(await screen.findByTestId('worker-processed-worker-1')).toHaveTextContent('1,280');
      expect(screen.getByTestId('worker-failed-worker-1')).toHaveTextContent('20');
      // A real 0 is shown as 0
      expect(screen.getByTestId('worker-processed-worker-2')).toHaveTextContent('0');
      expect(screen.getByTestId('worker-failed-worker-2')).toHaveTextContent('0');
      expect(screen.queryByText(/^Started /)).not.toBeInTheDocument();
    });

    it('shows no counters, and no made-up zeros, against a backend without them (0.1.121)', async () => {
      server.use(
        http.get('https://api.spooled.cloud/api/v1/workers', () =>
          HttpResponse.json(mockWorkersSummary.map(withoutWorkerCounters))
        )
      );
      render(<WorkersListPage />);

      await waitFor(() => {
        expect(screen.getAllByText('Current Jobs').length).toBeGreaterThan(0);
      });

      expect(screen.queryByText('Processed')).not.toBeInTheDocument();
      expect(screen.queryByText('Failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('worker-processed-worker-1')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Started /)).not.toBeInTheDocument();
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
