import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { mockAuthenticatedState } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { ApiKeysListPage } from './ApiKeysListPage';

describe('ApiKeysListPage', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
  });

  it('shows the rate limit per minute, not per second', async () => {
    render(<ApiKeysListPage />);
    await waitFor(() => expect(screen.getByText('120 requests/min')).toBeInTheDocument());
    expect(screen.queryByText(/req\/s/)).not.toBeInTheDocument();
  });

  it('badges system keys only, with an explanatory tooltip', async () => {
    render(<ApiKeysListPage />);
    const badge = await screen.findByText('System');
    expect(badge).toHaveAttribute(
      'title',
      'Created for dashboard sign-in; does not count toward your key limit'
    );
    expect(screen.getAllByText('System')).toHaveLength(1);
  });

  it('warns that revoking a system key ends dashboard sessions', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    const prev = useAuthStore.getState().user!;
    useAuthStore.setState({ user: { ...prev, api_key_id: 'some-other-key' } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');
    const buttons = screen.getAllByRole('button', { name: /revoke/i });
    await user.click(buttons[1]);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('ends dashboard sessions'));
    await user.click(buttons[0]);
    expect(confirmSpy).toHaveBeenLastCalledWith(
      expect.not.stringContaining('ends dashboard sessions')
    );
    confirmSpy.mockRestore();
  });

  it('does not allow revoking the key behind the current session', async () => {
    // mockAuthenticatedState signs in as key-1
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<ApiKeysListPage />);
    await screen.findByText('Dashboard session');

    expect(screen.getByText('Current session')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /revoke/i });
    // key-1 (current session) is disabled, key-2 stays revocable
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    await user.click(buttons[0]);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
