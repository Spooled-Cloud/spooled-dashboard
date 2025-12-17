/**
 * Tests for useDashboardTimeseries hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardTimeseries } from './useDashboardTimeseries';
import type { DashboardData } from '@/lib/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Date.now
let mockNow = 1700000000000;
vi.spyOn(Date, 'now').mockImplementation(() => mockNow);

// Helper to create mock dashboard data
function createMockDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    // Required backend fields
    system: {
      version: '1.0.0',
      uptime_seconds: 3600,
      started_at: '2024-01-01T00:00:00Z',
      database_status: 'healthy',
      cache_status: 'healthy',
      environment: 'test',
    },
    jobs: {
      total: 100,
      pending: 10,
      processing: 5,
      completed_24h: 80,
      failed_24h: 3,
      deadletter: 0,
      avg_wait_time_ms: 100,
      avg_processing_time_ms: 150,
    },
    queues: [],
    workers: {
      total: 5,
      healthy: 3,
      unhealthy: 2,
    },
    recent_activity: {
      jobs_created_1h: 50,
      jobs_completed_1h: 45,
      jobs_failed_1h: 2,
    },
    // Legacy mapped fields (used by the hook)
    job_statistics: {
      total: 100,
      pending: 10,
      processing: 5,
      completed: 80,
      failed: 3,
      cancelled: 2,
      deadletter: 0,
      success_rate: 96.4,
      avg_processing_time_ms: 150,
    },
    worker_status: {
      total: 5,
      active: 3,
      idle: 2,
      offline: 0,
    },
    queue_summaries: [],
    ...overrides,
  };
}

describe('useDashboardTimeseries', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockNow = 1700000000000;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty points when no persisted data', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      expect(result.current.points).toEqual([]);
      expect(result.current.pointCount).toBe(0);
      expect(result.current.lastUpdated).toBeNull();
    });

    it('should default to 15m time range', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      expect(result.current.timeRange).toBe('15m');
    });

    it('should not be paused by default', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      expect(result.current.isPaused).toBe(false);
    });

    it('should have correct sample interval for 15m range', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      expect(result.current.sampleInterval).toBe(30000);
    });
  });

  describe('time range', () => {
    it('should change time range when setTimeRange is called', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      act(() => {
        result.current.setTimeRange('1h');
      });

      expect(result.current.timeRange).toBe('1h');
    });

    it('should have correct sample interval for 6h range', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      act(() => {
        result.current.setTimeRange('6h');
      });

      expect(result.current.sampleInterval).toBe(60000);
    });
  });

  describe('pause and resume', () => {
    it('should pause when pause is called', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPaused).toBe(true);
    });

    it('should resume when resume is called', () => {
      const { result } = renderHook(() => useDashboardTimeseries(undefined));

      act(() => {
        result.current.pause();
        result.current.resume();
      });

      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('data collection', () => {
    it('should add a point immediately when dashboard data is provided', () => {
      const mockData = createMockDashboardData();

      // First sample happens immediately because lastSampleRef starts at 0
      const { result } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      // Should have 1 point immediately (first sample)
      expect(result.current.pointCount).toBe(1);
      expect(result.current.lastUpdated).toBe(mockNow);
    });

    it('should track points in derived trends', () => {
      const mockData = createMockDashboardData();

      const { result } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      // First point added, should be reflected in all trends
      expect(result.current.pointCount).toBe(1);
      expect(result.current.backlogTrend.length).toBe(1);
      expect(result.current.workerTrend.length).toBe(1);
      expect(result.current.failureTrend.length).toBe(1);
    });

    it('should not add points when paused', () => {
      // Start with no data to avoid immediate first sample
      const { result, rerender } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: undefined as DashboardData | undefined },
      });

      // Pause before providing data
      act(() => {
        result.current.pause();
      });

      const mockData = createMockDashboardData();

      // Advance time and provide data
      mockNow += 60000;
      rerender({ data: mockData });

      // Should still have no points (was paused)
      expect(result.current.pointCount).toBe(0);
    });

    it('should not add points when enabled is false', () => {
      const mockData = createMockDashboardData();

      const { result, rerender } = renderHook(
        ({ data }) => useDashboardTimeseries(data, { enabled: false }),
        { initialProps: { data: mockData } }
      );

      // Advance time
      mockNow += 60000;
      rerender({ data: mockData });

      // Should have no points
      expect(result.current.pointCount).toBe(0);
    });
  });

  describe('derived data', () => {
    it('should compute backlogTrend correctly', () => {
      const mockData = createMockDashboardData({
        job_statistics: {
          total: 100,
          pending: 15,
          processing: 8,
          completed: 70,
          failed: 5,
          cancelled: 2,
          deadletter: 2,
          success_rate: 93.3,
          avg_processing_time_ms: 150,
        },
      });

      const { result, rerender } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      // Advance time and add a point
      mockNow += 31000;
      rerender({ data: mockData });

      expect(result.current.backlogTrend.length).toBe(1);
      const point = result.current.backlogTrend[0];
      expect(point.pending).toBe(15);
      expect(point.processing).toBe(8);
      expect(point.total).toBe(23);
    });

    it('should compute workerTrend correctly', () => {
      const mockData = createMockDashboardData({
        worker_status: {
          total: 10,
          active: 6,
          idle: 4,
          offline: 0,
        },
      });

      const { result, rerender } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      mockNow += 31000;
      rerender({ data: mockData });

      expect(result.current.workerTrend.length).toBe(1);
      const point = result.current.workerTrend[0];
      expect(point.active).toBe(6);
      expect(point.idle).toBe(4);
      expect(point.total).toBe(10);
    });

    it('should compute failureTrend correctly', () => {
      const mockData = createMockDashboardData({
        job_statistics: {
          total: 100,
          pending: 10,
          processing: 5,
          completed: 80,
          failed: 12,
          cancelled: 2,
          deadletter: 3,
          success_rate: 86.9,
          avg_processing_time_ms: 150,
        },
      });

      const { result, rerender } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      mockNow += 31000;
      rerender({ data: mockData });

      expect(result.current.failureTrend.length).toBe(1);
      const point = result.current.failureTrend[0];
      expect(point.failed).toBe(12);
      expect(point.deadletter).toBe(3);
    });
  });

  describe('clear history', () => {
    it('should clear all points when clearHistory is called', () => {
      const mockData = createMockDashboardData();

      const { result, rerender } = renderHook(({ data }) => useDashboardTimeseries(data), {
        initialProps: { data: mockData },
      });

      // Add a point
      mockNow += 31000;
      rerender({ data: mockData });
      expect(result.current.pointCount).toBe(1);

      // Clear history
      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.pointCount).toBe(0);
      expect(result.current.points).toEqual([]);
      expect(result.current.lastUpdated).toBeNull();
    });

    it('should remove localStorage data when clearHistory is called with persist', () => {
      const mockData = createMockDashboardData();

      const { result, rerender } = renderHook(
        ({ data }) => useDashboardTimeseries(data, { persist: true }),
        { initialProps: { data: mockData } }
      );

      // Add a point
      mockNow += 31000;
      rerender({ data: mockData });

      // Clear history
      act(() => {
        result.current.clearHistory();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('spooled_dashboard_timeseries');
    });
  });

  describe('persistence', () => {
    it('should save to localStorage when persist is true', () => {
      const mockData = createMockDashboardData();

      const { rerender } = renderHook(
        ({ data }) => useDashboardTimeseries(data, { persist: true }),
        { initialProps: { data: mockData } }
      );

      // Add a point
      mockNow += 31000;
      rerender({ data: mockData });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'spooled_dashboard_timeseries',
        expect.any(String)
      );
    });

    it('should not save to localStorage when persist is false', () => {
      const mockData = createMockDashboardData();

      const { rerender } = renderHook(
        ({ data }) => useDashboardTimeseries(data, { persist: false }),
        { initialProps: { data: mockData } }
      );

      // Add a point
      mockNow += 31000;
      rerender({ data: mockData });

      // Check that setItem was not called for the timeseries key
      const persistenceCalls = localStorageMock.setItem.mock.calls.filter(
        (call: [string, string]) => call[0] === 'spooled_dashboard_timeseries'
      );
      expect(persistenceCalls.length).toBe(0);
    });

    it('should load persisted data on mount', () => {
      const persistedData = {
        version: 1,
        points: [
          {
            timestamp: mockNow - 60000, // 1 minute ago
            pending: 5,
            processing: 2,
            completed: 10,
            failed: 1,
            deadletter: 0,
            activeWorkers: 2,
            totalWorkers: 3,
            idleWorkers: 1,
          },
        ],
        lastUpdated: mockNow - 60000,
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(persistedData));

      const { result } = renderHook(() => useDashboardTimeseries(undefined, { persist: true }));

      expect(result.current.pointCount).toBe(1);
    });
  });
});
