import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { CopyButton, DataTablePagination } from './data-table';

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

describe('DataTablePagination', () => {
  const base = { currentPage: 1, totalPages: 4, totalItems: 100, pageSize: 25 };

  it('prints the count and the page total when the total is exact', () => {
    render(<DataTablePagination {...base} onPageChange={vi.fn()} />);

    expect(screen.getByText(/showing/i).textContent).toBe('Showing 1 to 25 of 100 results');
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('prints no count and no page total when the total is only a floor', () => {
    render(
      <DataTablePagination
        {...base}
        currentPage={2}
        totalPages={3}
        totalItems={51}
        itemCount={25}
        totalExact={false}
        hasMore
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Showing 26–50')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('ends the range at the rows really on a short last page', () => {
    render(
      <DataTablePagination
        {...base}
        currentPage={2}
        totalPages={2}
        totalItems={30}
        itemCount={5}
        totalExact={false}
        hasMore={false}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Showing 26–30')).toBeInTheDocument();
  });

  it('enables Next from hasMore alone when the total is not exact', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    // totalPages says "last page" (a floor), hasMore says another page follows
    const { rerender } = render(
      <DataTablePagination
        {...base}
        totalPages={1}
        totalItems={25}
        totalExact={false}
        hasMore
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    rerender(
      <DataTablePagination
        {...base}
        totalPages={9}
        totalItems={200}
        totalExact={false}
        hasMore={false}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('has no jump-to-last button when the last page is unknown', () => {
    render(
      <DataTablePagination
        {...base}
        showFirstLast
        totalExact={false}
        hasMore
        onPageChange={vi.fn()}
      />
    );

    // first, previous, next only
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
