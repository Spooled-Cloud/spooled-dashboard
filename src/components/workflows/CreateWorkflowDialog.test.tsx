import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/mocks/server';
import { render, screen, waitFor, within, mockAuthenticatedState } from '@/test/utils';
import { CreateWorkflowDialog } from './CreateWorkflowDialog';

const API_BASE = 'https://api.spooled.cloud';

beforeAll(() => {
  // Radix Select needs these in jsdom.
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = () => false;
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.scrollIntoView = () => {};
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

type User = ReturnType<typeof userEvent.setup>;

async function pickOption(user: User, triggerId: string, option: RegExp) {
  await user.click(document.getElementById(triggerId) as HTMLElement);
  const listbox = await screen.findByRole('listbox');
  await user.click(within(listbox).getByRole('option', { name: option }));
}

describe('CreateWorkflowDialog dependencies after renaming a job key', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('job 2 follows job 1 to its new key, in the options and in the request', async () => {
    let posted: { jobs: Array<{ key: string; depends_on?: string[] }> } | undefined;
    server.use(
      http.post(`${API_BASE}/api/v1/workflows`, async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json({ workflow_id: 'wf-1', job_ids: [], status: 'pending' });
      })
    );
    const user = userEvent.setup();
    render(<CreateWorkflowDialog />);

    await user.click(screen.getByRole('button', { name: /create workflow/i }));
    await user.type(await screen.findByLabelText(/workflow name/i), 'Pipeline');

    // Add job 2 first: it defaults to depending on job 1 (key "1").
    await user.click(screen.getByRole('button', { name: /add job/i }));

    // Now give job 1 a meaningful key, as the placeholder ("e.g., extract") suggests.
    const key1 = document.getElementById('job-0-key') as HTMLInputElement;
    await user.clear(key1);
    await user.type(key1, 'extract');
    await user.type(document.getElementById('job-0-type') as HTMLElement, 'extract_rows');

    // The dependency options carry what was typed, not the values from when job 2 was added.
    await user.click(document.getElementById('job-1-depends-on') as HTMLElement);
    const listbox = await screen.findByRole('listbox');
    const options = within(listbox)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toContain('Job 1: extract_rows');
    expect(options).not.toContain('Job 1: 1');
    await user.keyboard('{Escape}');

    await pickOption(user, 'job-0-queue', /^default$/);
    await pickOption(user, 'job-1-queue', /^default$/);
    await user.type(document.getElementById('job-1-type') as HTMLElement, 'load_rows');

    const form = key1.closest('form') as HTMLFormElement;
    await user.click(within(form).getByRole('button', { name: /create workflow/i }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(screen.queryByText(/Dependency must reference an earlier job/i)).not.toBeInTheDocument();
    expect(posted!.jobs.map((job) => job.key)).toEqual(['extract', '2']);
    expect(posted!.jobs[1].depends_on).toEqual(['extract']);
  });
});
