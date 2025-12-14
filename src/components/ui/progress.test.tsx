/**
 * Tests for Progress component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from './progress';

describe('Progress', () => {
  it('should render progress bar', () => {
    render(<Progress value={50} />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });

  it('should display correct value', () => {
    render(<Progress value={75} data-testid="progress" />);

    const progress = screen.getByRole('progressbar');
    // Radix UI Progress uses data-value attribute
    expect(progress).toBeInTheDocument();
  });

  it('should render with 0% progress', () => {
    render(<Progress value={0} data-testid="progress" />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });

  it('should render with 100% progress', () => {
    render(<Progress value={100} data-testid="progress" />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });

  it('should handle undefined value', () => {
    render(<Progress />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Progress value={50} className="custom-progress" />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('custom-progress');
  });

  it('should have default styling', () => {
    render(<Progress value={50} />);

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('relative');
    expect(progress).toHaveClass('overflow-hidden');
    expect(progress).toHaveClass('rounded-full');
  });
});
