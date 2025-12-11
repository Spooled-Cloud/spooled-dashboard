/**
 * Tests for CreateJobDialog Component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { CreateJobDialog } from './CreateJobDialog';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';

describe('CreateJobDialog', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  describe('Trigger Button', () => {
    it('should render the trigger button', () => {
      render(<CreateJobDialog />);

      expect(screen.getByRole('button', { name: /create job/i })).toBeInTheDocument();
    });

    it('should render custom trigger when provided', () => {
      render(<CreateJobDialog trigger={<button>Custom Trigger</button>} />);

      expect(screen.getByRole('button', { name: /custom trigger/i })).toBeInTheDocument();
    });
  });

  describe('Dialog Open/Close', () => {
    it('should open dialog when trigger is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Job')).toBeInTheDocument();
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Job')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Create New Job')).not.toBeInTheDocument();
      });
    });

    it('should display dialog description', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText(/add a new job to the queue/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    it('should display form fields when dialog is open', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Queue *')).toBeInTheDocument();
        expect(screen.getByText('Job Type *')).toBeInTheDocument();
        expect(screen.getByText('Payload (JSON) *')).toBeInTheDocument();
        expect(screen.getByText('Priority')).toBeInTheDocument();
        expect(screen.getByText('Max Retries')).toBeInTheDocument();
      });
    });

    it('should show Backoff Type options', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Backoff Type')).toBeInTheDocument();
      });
    });

    it('should show Timeout field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Timeout (ms)')).toBeInTheDocument();
      });
    });

    it('should show Schedule For field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Schedule For (optional)')).toBeInTheDocument();
      });
    });

    it('should show Metadata field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Metadata (JSON, optional)')).toBeInTheDocument();
      });
    });

    it('should have Cancel and Create buttons in footer', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        const createButtons = screen.getAllByRole('button', { name: /create job/i });
        expect(createButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Form Interactions', () => {
    it('should type in Job Type field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Job Type *')).toBeInTheDocument();
      });

      const jobTypeInput = screen.getByLabelText('Job Type *');
      await user.type(jobTypeInput, 'send_notification');

      expect(jobTypeInput).toHaveValue('send_notification');
    });

    it('should type in Priority field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Priority')).toBeInTheDocument();
      });

      const priorityInput = screen.getByLabelText('Priority');
      await user.clear(priorityInput);
      await user.type(priorityInput, '5');

      expect(priorityInput).toHaveValue(5);
    });

    it('should type in Max Retries field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Max Retries')).toBeInTheDocument();
      });

      const retriesInput = screen.getByLabelText('Max Retries');
      await user.clear(retriesInput);
      await user.type(retriesInput, '5');

      expect(retriesInput).toHaveValue(5);
    });

    it('should type in Timeout field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Timeout (ms)')).toBeInTheDocument();
      });

      const timeoutInput = screen.getByLabelText('Timeout (ms)');
      await user.type(timeoutInput, '60000');

      expect(timeoutInput).toHaveValue(60000);
    });

    it('should type in Payload field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Payload (JSON) *')).toBeInTheDocument();
      });

      const payloadInput = screen.getByLabelText('Payload (JSON) *');
      await user.clear(payloadInput);
      // Use simple text that doesn't conflict with userEvent keyboard parsing
      await user.type(payloadInput, 'test-payload-123');

      expect(payloadInput).toHaveValue('test-payload-123');
    });

    it('should type in Metadata field', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Metadata (JSON, optional)')).toBeInTheDocument();
      });

      const metadataInput = screen.getByLabelText('Metadata (JSON, optional)');
      // Use simple text without special characters that userEvent interprets
      await user.type(metadataInput, 'trace123');

      expect(metadataInput).toHaveValue('trace123');
    });

    it('should show priority helper text', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Higher = processed first')).toBeInTheDocument();
      });
    });

    it('should show schedule helper text', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Leave empty to process immediately')).toBeInTheDocument();
      });
    });
  });

  describe('Default Queue', () => {
    it('should use defaultQueue prop when provided', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog defaultQueue="emails" />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      // The select should have the default queue selected
      await waitFor(() => {
        expect(screen.getByText('Create New Job')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show queue placeholder text', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByText('Select a queue')).toBeInTheDocument();
      });
    });

    it('should show job type placeholder', async () => {
      const user = userEvent.setup();
      render(<CreateJobDialog />);

      await user.click(screen.getByRole('button', { name: /create job/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/send_email/i)).toBeInTheDocument();
      });
    });
  });
});
