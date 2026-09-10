import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JsonDisplay } from './JobDetailsPage';

describe('JsonDisplay', () => {
  it('renders non-object JSON instead of "No payload available"', () => {
    render(<JsonDisplay data="hello" title="Payload" />);
    expect(screen.getByText('"hello"')).toBeInTheDocument();
    expect(screen.queryByText(/No payload available/i)).not.toBeInTheDocument();
  });

  it('renders false, 0, and empty array payloads', () => {
    const { rerender } = render(<JsonDisplay data={false} title="Payload" />);
    expect(screen.getByText('false')).toBeInTheDocument();

    rerender(<JsonDisplay data={0} title="Payload" />);
    expect(screen.getByText('0')).toBeInTheDocument();

    rerender(<JsonDisplay data={[]} title="Payload" />);
    expect(screen.getByText('[]')).toBeInTheDocument();
  });

  it('still treats an empty object as missing', () => {
    render(<JsonDisplay data={{}} title="Payload" />);
    expect(screen.getByText(/No payload available/i)).toBeInTheDocument();
  });
});
