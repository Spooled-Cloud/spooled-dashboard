import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { mockWorkerDetails, withoutWorkerCounters } from '@/test/mocks/handlers';
import { WorkerDetailsPage } from './WorkerDetailsPage';

describe('WorkerDetailsPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    // Pages share the app-wide query client: start every test from an empty cache.
    queryClient.clear();
  });

  it('shows the counters and the success rate the backend sends (0.1.122)', async () => {
    render(<WorkerDetailsPage workerId="worker-1" />);
    const counters = await screen.findByTestId('worker-counters');

    expect(counters).toHaveTextContent('Jobs processed');
    expect(counters).toHaveTextContent('1,280');
    expect(counters).toHaveTextContent('Jobs failed');
    expect(counters).toHaveTextContent('20');
    // 1280 / (1280 + 20) = 98.46...
    expect(counters).toHaveTextContent('98.5%');
    // The start time comes from registered_at
    expect(screen.getByText('Started At')).toBeInTheDocument();
  });

  it('shows a dash instead of a rate for a worker that has finished nothing', async () => {
    render(<WorkerDetailsPage workerId="worker-2" />);
    const counters = await screen.findByTestId('worker-counters');

    expect(counters).toHaveTextContent('Jobs processed');
    expect(counters).toHaveTextContent('Success rate');
    expect(counters).toHaveTextContent('—');
    expect(counters).not.toHaveTextContent('%');
  });

  it('shows no counters and no success rate against a backend without them (0.1.121)', async () => {
    server.use(
      http.get('https://api.spooled.cloud/api/v1/workers/:id', () =>
        HttpResponse.json(withoutWorkerCounters(mockWorkerDetails['worker-1']))
      )
    );
    render(<WorkerDetailsPage workerId="worker-1" />);
    await screen.findByText('Current Load');

    expect(screen.queryByTestId('worker-counters')).not.toBeInTheDocument();
    expect(screen.queryByText(/jobs processed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/success rate/i)).not.toBeInTheDocument();
    expect(screen.getByText('Started At')).toBeInTheDocument();
  });
});
