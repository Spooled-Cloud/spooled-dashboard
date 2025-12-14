/**
 * Tests for OnboardingPage component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingPage } from './OnboardingPage';

// Mock the clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('OnboardingPage', () => {
  it('should render the organization creation form', () => {
    render(<OnboardingPage />);

    expect(screen.getByRole('heading', { name: 'Create Organization' })).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.getByLabelText('URL Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Billing Email (optional)')).toBeInTheDocument();
  });

  it('should have a disabled submit button when fields are empty', () => {
    render(<OnboardingPage />);

    const submitButton = screen.getByRole('button', { name: 'Create Organization' });
    expect(submitButton).toBeDisabled();
  });

  it('should auto-generate slug from name', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'My Test Company');

    const slugInput = screen.getByLabelText('URL Slug');
    expect(slugInput).toHaveValue('my-test-company');
  });

  it('should handle special characters in name when generating slug', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'Company @#$ Name!');

    const slugInput = screen.getByLabelText('URL Slug');
    expect(slugInput).toHaveValue('company-name');
  });

  it('should allow manual slug editing', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const slugInput = screen.getByLabelText('URL Slug');
    await user.type(slugInput, 'custom-slug');

    expect(slugInput).toHaveValue('custom-slug');
  });

  it('should enable submit button when required fields are filled', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'Test Organization');

    const submitButton = screen.getByRole('button', { name: 'Create Organization' });
    expect(submitButton).not.toBeDisabled();
  });

  it('should toggle admin key section', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    // Admin key section should be hidden by default
    expect(screen.queryByLabelText('Admin API Key')).not.toBeInTheDocument();

    // Click to show admin key section
    const adminToggle = screen.getByText('Admin Access');
    await user.click(adminToggle);

    // Admin key input should now be visible
    expect(screen.getByLabelText('Admin API Key')).toBeInTheDocument();
  });

  it('should display sign in link', () => {
    render(<OnboardingPage />);

    const signInLink = screen.getByText('Already have an API key? Sign in');
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute('href', '/');
  });

  it('should allow typing in billing email field', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const emailInput = screen.getByLabelText('Billing Email (optional)');
    await user.type(emailInput, 'billing@example.com');

    expect(emailInput).toHaveValue('billing@example.com');
  });

  it('should display organization details card title', () => {
    render(<OnboardingPage />);

    expect(screen.getByText('Organization Details')).toBeInTheDocument();
  });

  it('should display helpful description', () => {
    render(<OnboardingPage />);

    expect(
      screen.getByText('Enter your organization information. An API key will be generated for you.')
    ).toBeInTheDocument();
  });

  it('should display slug format hint', () => {
    render(<OnboardingPage />);

    expect(
      screen.getByText(
        /Used in URLs and API endpoints. Only lowercase letters, numbers, and hyphens/
      )
    ).toBeInTheDocument();
  });
});

describe('OnboardingPage slug generation', () => {
  it('should convert spaces to hyphens', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'Test Company Name');

    const slugInput = screen.getByLabelText('URL Slug');
    expect(slugInput).toHaveValue('test-company-name');
  });

  it('should convert to lowercase', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'TEST COMPANY');

    const slugInput = screen.getByLabelText('URL Slug');
    expect(slugInput).toHaveValue('test-company');
  });

  it('should remove leading and trailing hyphens', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, ' Test Company ');

    const slugInput = screen.getByLabelText('URL Slug');
    // Slug should not start or end with hyphen
    const value = (slugInput as HTMLInputElement).value;
    expect(value.startsWith('-')).toBe(false);
    expect(value.endsWith('-')).toBe(false);
  });

  it('should collapse multiple hyphens', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    const nameInput = screen.getByLabelText('Organization Name');
    await user.type(nameInput, 'Test   Company');

    const slugInput = screen.getByLabelText('URL Slug');
    const value = (slugInput as HTMLInputElement).value;
    expect(value.includes('--')).toBe(false);
  });
});
