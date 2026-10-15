import { describe, expect, it, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, mockAuthenticatedState } from '@/test/utils';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth';
import { OrganizationSettingsPage } from './OrganizationSettings';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

describe('OrganizationSettings rename', () => {
  beforeEach(async () => {
    await mockAuthenticatedState();
    queryClient.clear();
    vi.mocked(localStorage.setItem).mockClear();
  });

  it('writes the renamed organization into the auth store', async () => {
    const user = userEvent.setup();
    render(<OrganizationSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Organization Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Acme EU');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(useAuthStore.getState().currentOrganization?.name).toBe('Acme EU'));

    const writes = vi
      .mocked(localStorage.setItem)
      .mock.calls.filter((call) => call[0] === 'auth-storage');
    const last = String(writes[writes.length - 1]?.[1] ?? '');
    expect(last).toContain('Acme EU');
    expect(last).not.toContain('Test Organization');
  });
});
