/**
 * The trend history keeps 6 hours whatever range is selected. It used to be pruned (and
 * persisted) to the selected range on every sample, so on the default 15m range the 1h and 6h
 * views could never show more than 15 minutes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardTimeseries } from './useDashboardTimeseries';
import type { DashboardData } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';

let mockNow = 1700000000000;
vi.spyOn(Date, 'now').mockImplementation(() => mockNow);

function data(pending: number): DashboardData {
  return {
    job_statistics: {
      total: 0,
      pending,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      deadletter: 0,
      success_rate: 100,
      avg_processing_time_ms: 0,
    },
    worker_status: { total: 1, active: 1, idle: 0, offline: 0 },
  } as unknown as DashboardData;
}

describe('trend history range', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: {
        organization_id: 'org-1',
        api_key_id: 'key-1',
        queues: [],
        issued_at: '',
        expires_at: '',
      },
      currentOrganization: null,
    });
  });

  function sampleForAnHour() {
    const hook = renderHook(({ d }) => useDashboardTimeseries(d), {
      initialProps: { d: data(0) },
    });
    // One sample every 30 s for 60 minutes on the default (15m) range.
    for (let i = 1; i <= 120; i++) {
      mockNow += 30_000;
      hook.rerender({ d: data(i) });
    }
    return hook;
  }

  it('shows the whole hour on 1h after an hour on the default 15m range', () => {
    const { result } = sampleForAnHour();
    // The 15m view shows only its own window.
    expect(result.current.pointCount).toBeLessThanOrEqual(30);

    act(() => result.current.setTimeRange('1h'));
    const minutes = result.current.collectedDurationMs / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(result.current.pointCount).toBe(120);

    // Going back to 15m and on to 6h loses nothing.
    act(() => result.current.setTimeRange('15m'));
    act(() => result.current.setTimeRange('6h'));
    expect(result.current.collectedDurationMs / 60_000).toBeGreaterThan(55);
  });

  it('thins the 6h view to its point budget and keeps the newest sample', () => {
    const { result, rerender } = renderHook(({ d }) => useDashboardTimeseries(d), {
      initialProps: { d: data(0) },
    });
    // Six hours at 30 s: 720 samples, twice the 6h view's 360 points.
    for (let i = 1; i <= 720; i++) {
      mockNow += 30_000;
      rerender({ d: data(i) });
    }

    act(() => result.current.setTimeRange('6h'));
    expect(result.current.pointCount).toBeLessThanOrEqual(360);
    expect(result.current.pointCount).toBeGreaterThan(300);
    const points = result.current.points;
    expect(points[points.length - 1].pending).toBe(720);
  });
});
