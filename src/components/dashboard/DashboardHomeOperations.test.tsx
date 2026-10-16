import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { mockDashboard } from '@/test/mocks/handlers';
import { DashboardHomeEnhanced } from './DashboardHomeEnhanced';

const API_BASE = 'https://api.spooled.cloud';

const quietJobs = {
  total: 0,
  pending: 0,
  processing: 0,
  completed_24h: 0,
  failed_24h: 0,
  deadletter: 0,
  avg_wait_time_ms: null,
  avg_processing_time_ms: null,
};

function dashboard(overrides: {
  jobs?: Record<string, unknown>;
  queues?: Array<{ name: string; pending: number; processing: number; paused: boolean }>;
  workers?: { total: number; healthy: number; unhealthy: number; offline?: number };
}) {
  return {
    ...mockDashboard,
    jobs: { ...quietJobs, ...overrides.jobs },
    queues: overrides.queues ?? [],
    workers: overrides.workers ?? { total: 0, healthy: 0, unhealthy: 0 },
    recent_activity: { jobs_created_1h: 0, jobs_completed_1h: 0, jobs_failed_1h: 0 },
  };
}

function worker(id: string, status: string, heartbeat: string) {
  return {
    id,
    queue_name: 'default',
    hostname: id,
    status,
    current_jobs: status === 'healthy' ? 1 : 0,
    max_concurrency: 4,
    last_heartbeat: heartbeat,
    jobs_processed: 1,
    jobs_failed: 0,
  };
}

function stat(label: string) {
  return screen.getByRole('link', { name: (name) => name.trim().startsWith(label) });
}

describe('operations home supplements', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    server.use(
      http.get(`${API_BASE}/api/v1/workers`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/v1/queues`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/v1/jobs/stats`, () =>
        HttpResponse.json({
          total: 0,
          pending: 0,
          scheduled: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          deadletter: 0,
        })
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows scheduled jobs from the overview as a stat, not an incident', async () => {
    let statsCalls = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json(dashboard({ jobs: { scheduled: 8 } }))
      ),
      http.get(`${API_BASE}/api/v1/jobs/stats`, () => {
        statsCalls += 1;
        return HttpResponse.json({ scheduled: 0 });
      })
    );

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText(/All systems normal/)).toBeInTheDocument();
    expect(stat('Scheduled')).toHaveTextContent('8');
    expect(screen.queryByText('8 jobs scheduled')).not.toBeInTheDocument();
    expect(statsCalls).toBe(0);
  });

  it('falls back to job stats when the overview omits scheduled', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () => HttpResponse.json(dashboard({}))),
      http.get(`${API_BASE}/api/v1/jobs/stats`, () =>
        HttpResponse.json({
          total: 4,
          pending: 0,
          scheduled: 4,
          processing: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          deadletter: 0,
        })
      )
    );

    render(<DashboardHomeEnhanced />);
    await waitFor(() => expect(stat('Scheduled')).toHaveTextContent('4'));
    expect(screen.queryByText('4 jobs scheduled')).not.toBeInTheDocument();
  });

  it('says all clear only once scheduled is known to be zero', async () => {
    server.use(http.get(`${API_BASE}/api/v1/dashboard`, () => HttpResponse.json(dashboard({}))));

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText(/All systems normal/)).toBeInTheDocument();
    expect(stat('Scheduled')).toHaveTextContent('0');
  });

  it('counts an offline worker the overview dropped', async () => {
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json(
          dashboard({
            jobs: { scheduled: 0 },
            workers: { total: 4, healthy: 4, unhealthy: 0 },
          })
        )
      ),
      http.get(`${API_BASE}/api/v1/workers`, () =>
        HttpResponse.json([
          worker('w1', 'healthy', fresh),
          worker('w2', 'healthy', fresh),
          worker('w3', 'healthy', fresh),
          worker('w4', 'healthy', fresh),
          worker('w5', 'offline', stale),
        ])
      )
    );

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText('1 worker unhealthy')).toBeInTheDocument();
    expect(stat('Workers healthy')).toHaveTextContent('4 / 5');
    expect(screen.queryByText(/All systems normal/)).not.toBeInTheDocument();
  });

  it('does not add silent workers twice when the overview already counts them', async () => {
    const fresh = new Date().toISOString();
    const stale = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json(
          dashboard({
            jobs: { scheduled: 0 },
            workers: { total: 5, healthy: 4, unhealthy: 1 },
          })
        )
      ),
      http.get(`${API_BASE}/api/v1/workers`, () =>
        HttpResponse.json([
          worker('w1', 'healthy', fresh),
          worker('w2', 'healthy', fresh),
          worker('w3', 'healthy', fresh),
          worker('w4', 'healthy', fresh),
          worker('w5', 'offline', stale),
        ])
      )
    );

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText('1 worker unhealthy')).toBeInTheDocument();
    expect(stat('Workers healthy')).toHaveTextContent('4 / 5');
    expect(stat('Workers healthy')).not.toHaveTextContent('4 / 6');
  });

  it('keeps calling a fresh draining worker unhealthy', async () => {
    const fresh = new Date().toISOString();
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json(
          dashboard({
            jobs: { scheduled: 0 },
            workers: { total: 1, healthy: 0, unhealthy: 1 },
          })
        )
      ),
      http.get(`${API_BASE}/api/v1/workers`, () =>
        HttpResponse.json([worker('w1', 'draining', fresh)])
      )
    );

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText('1 worker unhealthy')).toBeInTheDocument();
    expect(screen.queryByText(/worker draining/i)).not.toBeInTheDocument();
  });

  it('includes a paused queue that the overview omitted', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/dashboard`, () =>
        HttpResponse.json(dashboard({ jobs: { scheduled: 0 }, queues: [] }))
      ),
      http.get(`${API_BASE}/api/v1/queues`, () =>
        HttpResponse.json([
          {
            queue_name: 'billing',
            max_retries: 3,
            default_timeout: 30,
            enabled: false,
          },
        ])
      )
    );

    render(<DashboardHomeEnhanced />);
    expect(await screen.findByText('billing')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText(/1 queue paused/)).toBeInTheDocument();
    expect(stat('Queues paused')).toHaveTextContent('1 / 1');
    expect(screen.queryByText('No queues configured')).not.toBeInTheDocument();
    expect(screen.queryByText(/All systems normal/)).not.toBeInTheDocument();
  });
});
