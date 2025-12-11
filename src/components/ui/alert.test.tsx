/**
 * Tests for Alert UI Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { Alert, AlertTitle, AlertDescription } from './alert';

describe('Alert', () => {
  it('should render default alert', () => {
    render(<Alert>Alert content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Alert content')).toBeInTheDocument();
  });

  it('should render destructive variant', () => {
    render(<Alert variant="destructive">Error message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-destructive/50');
  });

  it('should apply custom className', () => {
    render(<Alert className="custom-class">Content</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('custom-class');
  });
});

describe('AlertTitle', () => {
  it('should render title', () => {
    render(<AlertTitle>Alert Title</AlertTitle>);
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
  });

  it('should render as h5', () => {
    render(<AlertTitle>Title</AlertTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H5');
  });

  it('should apply custom className', () => {
    render(<AlertTitle className="custom-title">Title</AlertTitle>);
    expect(screen.getByText('Title')).toHaveClass('custom-title');
  });
});

describe('AlertDescription', () => {
  it('should render description', () => {
    render(<AlertDescription>Description text</AlertDescription>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<AlertDescription className="custom-desc">Description</AlertDescription>);
    expect(screen.getByText('Description')).toHaveClass('custom-desc');
  });
});

describe('Alert with Title and Description', () => {
  it('should render complete alert structure', () => {
    render(
      <Alert>
        <AlertTitle>Success!</AlertTitle>
        <AlertDescription>Your action was completed.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Your action was completed.')).toBeInTheDocument();
  });
});
