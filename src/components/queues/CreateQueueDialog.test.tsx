/**
 * Tests for CreateQueueDialog Component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { CreateQueueDialog } from './CreateQueueDialog';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';

describe('CreateQueueDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  describe('Trigger Button', () => {
    it('should render the trigger button', () => {
      render(<CreateQueueDialog />);

      expect(screen.getByRole('button', { name: /create queue/i })).toBeInTheDocument();
    });

    it('should render custom trigger when provided', () => {
      render(<CreateQueueDialog trigger={<button>Add Queue</button>} />);

      expect(screen.getByRole('button', { name: /add queue/i })).toBeInTheDocument();
    });
  });

  describe('Dialog Open/Close', () => {
    it('should open dialog when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Queue')).toBeInTheDocument();
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Queue')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Create New Queue')).not.toBeInTheDocument();
      });
    });

    it('should display dialog description', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText(/configure a new queue/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    it('should display form fields when dialog is open', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText('Queue Name *')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
      });
    });

    it('should have Cancel button in footer', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it('should show Concurrency field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Concurrency')).toBeInTheDocument();
      });
    });

    it('should show Max Retries field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Max Retries')).toBeInTheDocument();
      });
    });

    it('should show Retry Delay field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Retry Delay (ms)')).toBeInTheDocument();
      });
    });

    it('should show Backoff Multiplier field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Backoff Multiplier')).toBeInTheDocument();
      });
    });

    it('should show Max Retry Delay field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Max Retry Delay (ms)')).toBeInTheDocument();
      });
    });

    it('should show Job Timeout field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Job Timeout (ms)')).toBeInTheDocument();
      });
    });

    it('should have Create Queue button in footer', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        const createButtons = screen.getAllByRole('button', { name: /create queue/i });
        expect(createButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Form Interactions', () => {
    it('should type in Queue Name field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Queue Name *')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Queue Name *');
      await user.type(nameInput, 'notifications');

      expect(nameInput).toHaveValue('notifications');
    });

    it('should type in Description field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
      });

      const descInput = screen.getByLabelText('Description');
      await user.type(descInput, 'Queue for push notifications');

      expect(descInput).toHaveValue('Queue for push notifications');
    });

    it('should change Concurrency field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Concurrency')).toBeInTheDocument();
      });

      const concurrencyInput = screen.getByLabelText('Concurrency');
      await user.clear(concurrencyInput);
      await user.type(concurrencyInput, '20');

      expect(concurrencyInput).toHaveValue(20);
    });

    it('should change Max Retries field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Max Retries')).toBeInTheDocument();
      });

      const retriesInput = screen.getByLabelText('Max Retries');
      await user.clear(retriesInput);
      await user.type(retriesInput, '5');

      expect(retriesInput).toHaveValue(5);
    });

    it('should change Retry Delay field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Retry Delay (ms)')).toBeInTheDocument();
      });

      const delayInput = screen.getByLabelText('Retry Delay (ms)');
      await user.clear(delayInput);
      await user.type(delayInput, '2000');

      expect(delayInput).toHaveValue(2000);
    });

    it('should change Job Timeout field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Job Timeout (ms)')).toBeInTheDocument();
      });

      const timeoutInput = screen.getByLabelText('Job Timeout (ms)');
      await user.clear(timeoutInput);
      await user.type(timeoutInput, '600000');

      expect(timeoutInput).toHaveValue(600000);
    });
  });

  describe('Helper Text', () => {
    it('should show queue name format helper', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText(/letters, numbers, underscores/i)).toBeInTheDocument();
      });
    });

    it('should show concurrency helper', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText(/max parallel jobs/i)).toBeInTheDocument();
      });
    });

    it('should show retry attempts helper', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByText(/retry attempts on failure/i)).toBeInTheDocument();
      });
    });
  });

  describe('Placeholders', () => {
    it('should show queue name placeholder', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/emails, notifications/i)).toBeInTheDocument();
      });
    });

    it('should show description placeholder', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/optional description/i)).toBeInTheDocument();
      });
    });
  });
});
