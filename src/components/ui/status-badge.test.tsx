/**
 * Tests for StatusBadge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { JobStatusBadge, QueueStatusBadge, StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the status label for accessibility', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('allows a custom label override', () => {
    render(<StatusBadge status="active" label="Running" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('applies status design token classes', () => {
    render(<StatusBadge status="failed" />);
    const badge = screen.getByText('Failed');
    expect(badge).toHaveClass('text-status-failed-foreground');
    expect(badge).toHaveClass('bg-status-failed/10');
  });

  it('renders job status badges with labels', () => {
    render(<JobStatusBadge status="processing" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders queue status from paused flag', () => {
    render(<QueueStatusBadge paused={true} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });
});
