import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, mockAuthenticatedState } from '@/test/utils';
import { WorkerDetailsPage } from './WorkerDetailsPage';

describe('WorkerDetailsPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows real fields only: no processed/failed counters or success rate', async () => {
    render(<WorkerDetailsPage workerId="worker-1" />);
    await screen.findByText('Current Load');

    expect(screen.queryByText('Jobs Processed')).not.toBeInTheDocument();
    expect(screen.queryByText('Jobs Failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Success Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Processed')).not.toBeInTheDocument();
    // The start time comes from registered_at
    expect(screen.getByText('Started At')).toBeInTheDocument();
  });
});
