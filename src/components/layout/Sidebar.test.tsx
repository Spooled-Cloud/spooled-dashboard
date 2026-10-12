import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@/test/utils';
import { Sidebar } from './Sidebar';
import { useShellStore } from '@/stores/shell';

vi.mock('@/lib/hooks/use-runtime-features', () => ({
  useRuntimeFeatures: () => ({ enableWorkflows: true, enableSchedules: true }),
}));

describe('Sidebar mobile navigation drawer', () => {
  beforeEach(() => {
    useShellStore.setState({ mobileNavOpen: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a labelled and described dialog, so Radix has nothing to warn about', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Sidebar />);

    act(() => {
      useShellStore.getState().setMobileNavOpen(true);
    });

    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' });
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(/links to/i);

    const radixWarnings = [...warn.mock.calls, ...error.mock.calls].filter((call) =>
      /Missing `Description`|aria-describedby/.test(String(call[0]))
    );
    expect(radixWarnings).toEqual([]);
  });
});
