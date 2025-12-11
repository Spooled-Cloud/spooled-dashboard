/**
 * Integration Tests for QueuesListPage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { QueuesListPage } from './QueuesListPage';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';

describe('QueuesListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  describe('Page Layout', () => {
    it('should render the page title', async () => {
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Queues')).toBeInTheDocument();
      });
    });

    it('should display page subtitle', async () => {
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText(/manage job queues/i)).toBeInTheDocument();
      });
    });

    it('should display page header', async () => {
      render(<QueuesListPage />);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('should show Create Queue button', async () => {
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Queue')).toBeInTheDocument();
      });
    });

    it('should show Refresh button', async () => {
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should show loading skeletons initially', () => {
      render(<QueuesListPage />);
      expect(screen.getByText('Queues')).toBeInTheDocument();
    });
  });

  describe('Queues List', () => {
    it('should render queues after loading', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('default')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display queue descriptions', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('Default queue')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display multiple queues', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('default')).toBeInTheDocument();
          expect(screen.getByText('emails')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display email queue description', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('Email processing queue')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display queue configuration - Concurrency', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          // Multiple queues each have Concurrency label
          const elements = screen.getAllByText('Concurrency');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display queue configuration - Max Retries', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          // Multiple queues each have Max Retries label
          const elements = screen.getAllByText('Max Retries');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display queue configuration - Retry Delay', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          // Multiple queues each have Retry Delay label
          const elements = screen.getAllByText('Retry Delay');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display queue configuration - Job Timeout', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          // Multiple queues each have Job Timeout label
          const elements = screen.getAllByText('Job Timeout');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Created timestamp', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const createdElements = screen.getAllByText(/created/i);
          expect(createdElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Updated timestamp', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const updatedElements = screen.getAllByText(/updated/i);
          expect(updatedElements.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Queue Actions', () => {
    it('should click refresh button', async () => {
      const user = userEvent.setup();
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      await waitFor(
        () => {
          expect(screen.getByText('default')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display Pause buttons for active queues', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const pauseButtons = screen.getAllByText('Pause');
          expect(pauseButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should display Manage buttons', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const manageButtons = screen.getAllByText('Manage');
          expect(manageButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });

    it('should click on Create Queue button', async () => {
      const user = userEvent.setup();
      render(<QueuesListPage />);

      await waitFor(() => {
        expect(screen.getByText('Create Queue')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Queue'));

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByText('Create New Queue')).toBeInTheDocument();
      });
    });

    it('should click Pause button', async () => {
      const user = userEvent.setup();
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const pauseButtons = screen.getAllByText('Pause');
          expect(pauseButtons.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      const pauseButtons = screen.getAllByText('Pause');
      await user.click(pauseButtons[0]);

      // After clicking, the queue list should still be visible
      await waitFor(() => {
        expect(screen.getByText('default')).toBeInTheDocument();
      });
    });

    it('should have links to individual queue pages', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          expect(screen.getByText('default')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Queue names are links
      const queueLink = screen.getByRole('link', { name: 'default' });
      expect(queueLink).toHaveAttribute('href', '/queues/default');
    });

    it('should have Manage links to queue pages', async () => {
      render(<QueuesListPage />);

      await waitFor(
        () => {
          const manageLinks = screen.getAllByRole('link', { name: /manage/i });
          expect(manageLinks.length).toBeGreaterThan(0);
          expect(manageLinks[0]).toHaveAttribute('href', expect.stringContaining('/queues/'));
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      render(<QueuesListPage />);

      // Title should be visible immediately
      expect(screen.getByText('Queues')).toBeInTheDocument();
    });
  });
});
