import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { WORKFLOW_POLL_MS } from '@/lib/api/workflows';
import { WorkflowDetailsPage } from './WorkflowDetailsPage';
import { WorkflowsListPage } from './WorkflowsListPage';

const API_BASE = 'https://api.spooled.cloud';

function pollMs(keyPrefix: string): number | false | undefined {
  const query = queryClient.getQueryCache().findAll({
    predicate: (entry) =>
      Array.isArray(entry.queryKey) &&
      entry.queryKey[0] === 'workflows' &&
      entry.queryKey[1] === keyPrefix,
  })[0];
  if (!query) return undefined;
  // The interval lives on the observer. Query.options does not type it.
  const interval = query.observers[0]?.options.refetchInterval;
  if (typeof interval === 'function') {
    return interval(query);
  }
  return interval;
}

function job(id: string, status: string) {
  return {
    id,
    organization_id: 'org-1',
    queue: 'default',
    job_type: 'step',
    payload: {},
    status,
    priority: 0,
    attempt: 0,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2024-01-01T00:00:00Z',
  };
}

describe('workflow screens stay current', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('polls the list while a workflow is pending', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workflows`, () =>
        HttpResponse.json([
          {
            id: 'wf-live',
            name: 'Nightly',
            status: 'pending',
            total_jobs: 2,
            completed_jobs: 0,
            failed_jobs: 0,
            progress_percent: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ])
      )
    );

    render(<WorkflowsListPage />);
    expect(await screen.findByText('Nightly')).toBeInTheDocument();
    expect(pollMs('list')).toBe(WORKFLOW_POLL_MS);
  });

  it('does not poll the list when every workflow is finished', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workflows`, () =>
        HttpResponse.json([
          {
            id: 'wf-done',
            name: 'Archive',
            status: 'completed',
            total_jobs: 1,
            completed_jobs: 1,
            failed_jobs: 0,
            progress_percent: 100,
            created_at: '2024-01-01T00:00:00Z',
          },
        ])
      )
    );

    render(<WorkflowsListPage />);
    expect(await screen.findByText('Archive')).toBeInTheDocument();
    expect(pollMs('list')).toBe(false);
  });

  it('polls a pending workflow detail', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workflows/:id`, () =>
        HttpResponse.json({
          id: 'wf-live',
          organization_id: 'org-1',
          name: 'Nightly',
          status: 'pending',
          jobs: [job('job-a', 'pending')],
          dependencies: [],
          progress: { total: 1, completed: 0, failed: 0, pending: 1, processing: 0 },
          created_at: '2024-01-01T00:00:00Z',
        })
      )
    );

    render(<WorkflowDetailsPage workflowId="wf-live" />);
    expect(await screen.findByText('Nightly')).toBeInTheDocument();
    expect(pollMs('detail')).toBe(WORKFLOW_POLL_MS);
  });
});

describe('workflow detail progress', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
  });

  it('paints cancelled steps as cancelled when failed includes them', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workflows/:id`, () =>
        HttpResponse.json({
          id: 'wf-cancel',
          organization_id: 'org-1',
          name: 'Stopped',
          status: 'cancelled',
          jobs: [job('job-a', 'cancelled'), job('job-b', 'cancelled')],
          dependencies: [],
          progress: { total: 2, completed: 0, failed: 2, pending: 0, processing: 0 },
          created_at: '2024-01-01T00:00:00Z',
        })
      )
    );

    render(<WorkflowDetailsPage workflowId="wf-cancel" />);
    expect(await screen.findByText('Cancelled (2)')).toBeInTheDocument();
    expect(screen.getByText('Failed (0)')).toBeInTheDocument();
    expect(screen.queryByText('Failed (2)')).not.toBeInTheDocument();
  });

  it('uses a cancelled count from progress when the backend sends one', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workflows/:id`, () =>
        HttpResponse.json({
          id: 'wf-split',
          organization_id: 'org-1',
          name: 'Split',
          status: 'failed',
          jobs: [job('job-a', 'cancelled'), job('job-b', 'failed')],
          dependencies: [],
          progress: {
            total: 2,
            completed: 0,
            failed: 1,
            pending: 0,
            processing: 0,
            cancelled: 1,
          },
          created_at: '2024-01-01T00:00:00Z',
        })
      )
    );

    render(<WorkflowDetailsPage workflowId="wf-split" />);
    expect(await screen.findByText('Cancelled (1)')).toBeInTheDocument();
    expect(screen.getByText('Failed (1)')).toBeInTheDocument();
  });
});
