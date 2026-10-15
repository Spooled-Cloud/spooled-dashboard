/**
 * Tests for CreateQueueDialog Component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen, waitFor } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
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

    it('should show Max Retries field', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);

      await user.click(screen.getByRole('button', { name: /create queue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Max Retries')).toBeInTheDocument();
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

  describe('Unenforced settings', () => {
    it('does not offer concurrency, retry delay or backoff controls', async () => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);
      await user.click(screen.getByRole('button', { name: /create queue/i }));
      await waitFor(() => expect(screen.getByLabelText('Max Retries')).toBeInTheDocument());

      expect(screen.queryByLabelText('Concurrency')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Retry Delay (ms)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Backoff Multiplier')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Max Retry Delay (ms)')).not.toBeInTheDocument();
    });
  });

  describe('Existing queue', () => {
    it('refuses to overwrite an existing queue and links to its edit page', async () => {
      let putCalls = 0;
      server.use(
        http.put('https://api.spooled.cloud/api/v1/queues/:name/config', () => {
          putCalls += 1;
          return HttpResponse.json({}, { status: 200 });
        })
      );
      const user = userEvent.setup();
      render(<CreateQueueDialog />);
      await user.click(screen.getByRole('button', { name: /create queue/i }));
      await user.type(await screen.findByLabelText(/queue name/i), 'emails');
      await user.click(screen.getAllByRole('button', { name: /create queue/i }).pop()!);

      const link = await screen.findByRole('link', { name: /edit it instead/i });
      expect(link).toHaveAttribute('href', '/queues/emails');
      expect(putCalls).toBe(0);
    });

    it('creates the queue when none with that name exists', async () => {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.put('https://api.spooled.cloud/api/v1/queues/:name/config', async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            {
              id: 'q',
              organization_id: 'org-1',
              queue_name: 'brand.new',
              max_retries: 0,
              default_timeout: 300,
              rate_limit: null,
              enabled: true,
              settings: {},
              created_at: '2026-10-01T00:00:00Z',
              updated_at: '2026-10-01T00:00:00Z',
            },
            { status: 201 }
          );
        })
      );
      const user = userEvent.setup();
      render(<CreateQueueDialog />);
      await user.click(screen.getByRole('button', { name: /create queue/i }));
      await user.type(await screen.findByLabelText(/queue name/i), 'brand.new');
      const retries = screen.getByLabelText('Max Retries');
      await user.clear(retries);
      await user.type(retries, '0');
      await user.click(screen.getAllByRole('button', { name: /create queue/i }).pop()!);

      await waitFor(() => expect(body).not.toBeNull());
      expect(body).toMatchObject({ queue_name: 'brand.new', max_retries: 0 });
      expect(body!.settings).not.toHaveProperty('concurrency');
    });
  });

  describe('Name validation', () => {
    it.each([
      ['orders.eu', true],
      ['-bad', false],
      ['.bad', false],
      ['has space', false],
    ])('queue name %s accepted=%s', async (name, ok) => {
      const user = userEvent.setup();
      render(<CreateQueueDialog />);
      await user.click(screen.getByRole('button', { name: /create queue/i }));
      await user.type(await screen.findByLabelText(/queue name/i), name);
      await user.click(screen.getAllByRole('button', { name: /create queue/i }).pop()!);

      if (ok) {
        await waitFor(() =>
          expect(screen.queryByText(/can only contain/i)).not.toBeInTheDocument()
        );
      } else {
        expect(await screen.findByText(/can only contain/i)).toBeInTheDocument();
      }
    });
  });

  describe('Job timeout', () => {
    it.each(['0', '1500'])('rejects %s instead of storing a shorter timeout', async (value) => {
      let puts = 0;
      server.use(
        http.put('https://api.spooled.cloud/api/v1/queues/:name/config', async () => {
          puts += 1;
          return HttpResponse.json({}, { status: 201 });
        })
      );
      const user = userEvent.setup();
      render(<CreateQueueDialog />);
      await user.click(screen.getByRole('button', { name: /create queue/i }));
      await user.type(await screen.findByLabelText(/queue name/i), 'ms-timeout');
      const timeout = screen.getByLabelText('Job Timeout (ms)');
      fireEvent.change(timeout, { target: { value } });
      // min="1000" blocks 0 before onSubmit. Skip native checks so this reaches
      // the handler that used to turn 0 into the 5-minute default.
      timeout.closest('form')!.noValidate = true;
      await user.click(screen.getAllByRole('button', { name: /create queue/i }).pop()!);

      expect(await screen.findByText(/whole number of seconds/i)).toBeInTheDocument();
      expect(puts).toBe(0);
    });
  });
});
