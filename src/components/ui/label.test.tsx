/**
 * Tests for Label UI Component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { Label } from './label';

describe('Label', () => {
  it('should render label element', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should accept htmlFor attribute', () => {
    render(<Label htmlFor="email-input">Email</Label>);
    expect(screen.getByText('Email')).toHaveAttribute('for', 'email-input');
  });

  it('should apply custom className', () => {
    render(<Label className="custom-label">Label</Label>);
    expect(screen.getByText('Label')).toHaveClass('custom-label');
  });

  it('should render with required asterisk when needed', () => {
    render(<Label>Name *</Label>);
    expect(screen.getByText('Name *')).toBeInTheDocument();
  });
});
