import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, act, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { UsageWidget } from './UsageWidget';

const API_BASE = 'https://api.spooled.cloud';

const item = (current: number, limit: number | null) => ({
  current,
  limit,
  percentage: limit ? (current / limit) * 100 : null,
  is_disabled: false,
});

const usageBody = {
  plan: 'free',
  plan_display_name: 'Free',
  limits: {
    tier: 'free',
    display_name: 'Free',
    max_jobs_per_day: 1000,
    max_active_jobs: 10,
    max_queues: 5,
    max_workers: 2,
    max_api_keys: 2,
    max_schedules: 2,
    max_workflows: 2,
    max_webhooks: 2,
    max_payload_size_bytes: 65536,
    rate_limit_requests_per_second: 5,
    rate_limit_burst: 10,
    job_retention_days: 7,
    history_retention_days: 7,
  },
  usage: {
    jobs_today: item(1, 1000),
    active_jobs: item(0, 10),
    queues: item(1, 5),
    workers: item(0, 2),
    api_keys: item(1, 2),
    schedules: item(0, 2),
    workflows: item(0, 2),
    webhooks: item(0, 2),
  },
  warnings: [],
};

describe('UsageWidget', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('clears the error card once a retry succeeds', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_BASE}/api/v1/organizations/usage`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json(usageBody);
      })
    );
    const user = userEvent.setup();
    render(<UsageWidget />);

    await user.click(await screen.findByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(screen.queryByText(/could not load usage/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  describe('when a refresh fails after a good load', () => {
    let refreshTick: (() => void) | undefined;

    beforeEach(() => {
      // Capture the 60 s refresh callback and fire it by hand. Other intervals (Testing
      // Library's waitFor polling) keep running on the real timer.
      const realSetInterval = globalThis.setInterval;
      refreshTick = undefined;
      vi.spyOn(globalThis, 'setInterval').mockImplementation(((
        handler: () => void,
        ms?: number,
        ...args: unknown[]
      ) => {
        if (ms === 60_000) {
          refreshTick = handler;
          return 0 as unknown as ReturnType<typeof setInterval>;
        }
        return realSetInterval(handler, ms, ...args);
      }) as typeof setInterval);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps showing the last good numbers instead of the error card', async () => {
      let calls = 0;
      server.use(
        http.get(`${API_BASE}/api/v1/organizations/usage`, () => {
          calls += 1;
          if (calls === 1) return HttpResponse.json(usageBody);
          return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
        })
      );
      render(<UsageWidget />);
      expect(await screen.findByText('Jobs Today')).toBeInTheDocument();
      expect(screen.getByText('1 / 1000')).toBeInTheDocument();
      expect(refreshTick).toBeDefined();

      await act(async () => {
        refreshTick!();
      });
      await waitFor(() => expect(calls).toBe(2));
      // Let the failed refresh settle into component state.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByText(/could not load usage/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
      expect(screen.getByText('Jobs Today')).toBeInTheDocument();
      expect(screen.getByText('1 / 1000')).toBeInTheDocument();
    });
  });
});
