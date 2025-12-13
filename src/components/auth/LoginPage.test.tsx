import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

// Mock zustand store hook
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ setAuth: vi.fn() }),
}));

describe('LoginPage', () => {
  it('shows a "Forgot password?" link and can switch to email recovery mode', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    const forgot = screen.getByRole('button', { name: 'Forgot password?' });
    await user.click(forgot);

    expect(screen.getByRole('heading', { name: 'Recover Access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});


