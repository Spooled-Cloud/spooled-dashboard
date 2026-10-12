import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CopyButton } from './data-table';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

describe('CopyButton', () => {
  it('copies the value', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<CopyButton value="job-123" />);

    await user.click(screen.getByTitle('Copy to clipboard'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('job-123'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast when the clipboard is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('NotAllowedError'));
    vi.mocked(toast.error).mockClear();
    render(<CopyButton value="job-123" />);

    await user.click(screen.getByTitle('Copy to clipboard'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/could not copy/i);
  });
});
