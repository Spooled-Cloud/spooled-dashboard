import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { setAdminKey } from '@/lib/api/admin';
import { AdminDashboard } from './AdminDashboard';

const API_BASE = 'https://api.spooled.cloud';

function statsWith(completed: number, failed: number) {
  return {
    organizations: {
      total: 3,
      by_plan: [{ plan: 'free', count: 3 }],
      created_today: 0,
      created_this_week: 1,
    },
    jobs: {
      total_active: 0,
      pending: 0,
      processing: 0,
      completed_24h: completed,
      failed_24h: failed,
    },
    workers: { total: 1, healthy: 1, degraded: 0 },
    system: { api_version: '0.1.121', uptime_seconds: 10 },
  };
}

describe('AdminDashboard failure rate', () => {
  beforeEach(() => {
    setAdminKey('test-admin-key');
  });

  it.each([
    [0, 5000, '100.0% failure rate'],
    [100, 100, '50.0% failure rate'],
    [10, 90, '90.0% failure rate'],
    [100, 0, '0.0% failure rate'],
    [0, 0, 'n/a failure rate'],
  ])('completed=%i failed=%i shows %s', async (completed, failed, expected) => {
    server.use(
      http.get(`${API_BASE}/api/v1/admin/stats`, () =>
        HttpResponse.json(statsWith(completed, failed))
      )
    );
    render(<AdminDashboard />);
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
