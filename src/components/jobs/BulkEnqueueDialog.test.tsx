import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { BulkEnqueueDialog, jobHasRequiredPayload } from './BulkEnqueueDialog';

describe('BulkEnqueueDialog default max retries', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  async function enqueueWithRetries(value: string) {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.post('https://api.spooled.cloud/api/v1/jobs/bulk', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success_count: 2, failure_count: 0, results: [] });
      })
    );
    const user = userEvent.setup();
    render(<BulkEnqueueDialog />);
    await user.click(screen.getByRole('button', { name: /bulk enqueue/i }));
    await user.type(await screen.findByLabelText(/queue name/i), 'emails');
    const retries = screen.getByLabelText('Default Max Retries');
    await user.clear(retries);
    if (value) await user.type(retries, value);
    await user.click(screen.getByRole('button', { name: /enqueue jobs/i }));
    await waitFor(() => expect(posted).toBeDefined());
    return posted as Record<string, unknown>;
  }

  it('sends an explicit 0 instead of replacing it with 3', async () => {
    expect((await enqueueWithRetries('0')).default_max_retries).toBe(0);
  });

  it('defaults an empty field to 3', async () => {
    expect((await enqueueWithRetries('')).default_max_retries).toBe(3);
  });
});

describe('jobHasRequiredPayload', () => {
  it('accepts non-object JSON payloads the old object check rejected', () => {
    expect(jobHasRequiredPayload({ payload: 'hello' })).toBe(true);
    expect(jobHasRequiredPayload({ payload: false })).toBe(true);
    expect(jobHasRequiredPayload({ payload: 0 })).toBe(true);
    expect(jobHasRequiredPayload({ payload: [] })).toBe(true);
    expect(jobHasRequiredPayload({ payload: null })).toBe(true);
  });

  it('rejects jobs that omit payload', () => {
    expect(jobHasRequiredPayload({})).toBe(false);
    expect(jobHasRequiredPayload(null)).toBe(false);
    expect(jobHasRequiredPayload('job')).toBe(false);
  });
});
