import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const load = vi.hoisted(() => vi.fn());

vi.mock('@/lib/config/runtime', () => ({
  getRuntimeConfig: () => ({ enableWorkflows: true, enableSchedules: true }),
  loadRuntimeConfig: load,
}));

import { useRuntimeFeatures } from './use-runtime-features';

describe('useRuntimeFeatures', () => {
  afterEach(() => {
    load.mockReset();
  });

  it('does not leak an unhandled rejection when /api/config fails', async () => {
    load.mockRejectedValue(new Error('Failed to fetch runtime config: HTTP 502'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const { result } = renderHook(() => useRuntimeFeatures());
      await new Promise((r) => setTimeout(r, 20));

      expect(result.current).toEqual({
        enableWorkflows: true,
        enableSchedules: true,
        loaded: false,
      });
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('reports the loaded flags on success', async () => {
    load.mockResolvedValue({ enableWorkflows: false, enableSchedules: true });
    const { result } = renderHook(() => useRuntimeFeatures());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.enableWorkflows).toBe(false);
  });
});
