/**
 * Capacity counts only workers that can take jobs. The backend keeps offline worker rows for
 * 7 days (restarts, deregistrations) and a draining worker takes no new jobs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { QueueDetailsPage } from './QueueDetailsPage';
import { WorkersListPage } from '@/components/workers/WorkersListPage';

const API_BASE = 'https://api.spooled.cloud';

function worker(id: string, status: string, current: number) {
  return {
    id,
    queue_name: 'default',
    hostname: id,
    status,
    current_jobs: current,
    max_concurrency: 10,
    last_heartbeat: '2026-11-16T10:00:00Z',
    jobs_processed: 0,
    jobs_failed: 0,
  };
}

const oneLiveFourOfflineOneDraining = [
  worker('live-1', 'healthy', 10),
  worker('old-1', 'offline', 0),
  worker('old-2', 'offline', 0),
  worker('old-3', 'offline', 0),
  worker('old-4', 'offline', 0),
  worker('drain-1', 'draining', 0),
];

describe('Queue capacity', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('leaves offline and draining workers out of Total Capacity, utilization and backlog', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workers`, () =>
        HttpResponse.json(oneLiveFourOfflineOneDraining)
      ),
      http.get(`${API_BASE}/api/v1/queues/:name/stats`, ({ params }) =>
        HttpResponse.json({
          queue_name: params.name,
          pending_jobs: 500,
          processing_jobs: 10,
          completed_jobs_24h: 100,
          failed_jobs_24h: 0,
          deadletter_jobs: 0,
          avg_processing_time_ms: 60000,
          max_job_age_seconds: 1,
          active_workers: 1,
        })
      )
    );
    render(<QueueDetailsPage queueName="default" />);
    // The single live worker is saturated: 10 of its 10 slots.
    expect(await screen.findByText('10 of 10 slots in use')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    // Backlog: 500 jobs * 1 min / 10 slots.
    expect(screen.getByText('~50.0 min')).toBeInTheDocument();
  });
});

describe('Workers page capacity', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('counts only the slots of workers that can take jobs', async () => {
    server.use(
      http.get(`${API_BASE}/api/v1/workers`, () => HttpResponse.json(oneLiveFourOfflineOneDraining))
    );
    render(<WorkersListPage />);
    const label = await screen.findByText('Total Capacity');
    expect(label.nextElementSibling?.textContent).toBe('10');
  });
});
