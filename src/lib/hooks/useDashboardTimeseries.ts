/**
 * Dashboard Timeseries Hook
 *
 * Collects dashboard snapshots over time and provides time series data
 * for trend charts. Uses client-side sampling with optional localStorage persistence.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DashboardData } from '@/lib/types';

// Timeseries data point
export interface TimeseriesPoint {
  timestamp: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadletter: number;
  activeWorkers: number;
  totalWorkers: number;
  idleWorkers: number;
}

// Time range options
export type TimeRange = '15m' | '1h' | '6h';

// Configuration
const TIME_RANGE_CONFIG: Record<TimeRange, { maxPoints: number; intervalMs: number }> = {
  '15m': { maxPoints: 30, intervalMs: 30000 }, // 30 points at 30s intervals = 15min
  '1h': { maxPoints: 120, intervalMs: 30000 }, // 120 points at 30s intervals = 1hr
  '6h': { maxPoints: 360, intervalMs: 60000 }, // 360 points at 60s intervals = 6hr
};

const STORAGE_KEY = 'spooled_dashboard_timeseries';
const STORAGE_VERSION = 1;

interface StoredData {
  version: number;
  points: TimeseriesPoint[];
  lastUpdated: number;
}

interface UseDashboardTimeseriesOptions {
  persist?: boolean;
  enabled?: boolean;
}

interface UseDashboardTimeseriesReturn {
  // Data
  points: TimeseriesPoint[];
  // Derived data for charts
  backlogTrend: Array<{ timestamp: number; pending: number; processing: number; total: number }>;
  workerTrend: Array<{ timestamp: number; active: number; idle: number; total: number }>;
  failureTrend: Array<{ timestamp: number; failed: number; deadletter: number }>;
  // Controls
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  clearHistory: () => void;
  // Meta
  lastUpdated: number | null;
  sampleInterval: number;
  pointCount: number;
  /** Actual duration of collected data in milliseconds */
  collectedDurationMs: number;
  /** Expected duration for the selected time range in milliseconds */
  expectedDurationMs: number;
}

/**
 * Convert dashboard data to a timeseries point
 */
function dashboardToPoint(data: DashboardData): TimeseriesPoint {
  const stats = data.job_statistics;
  const workers = data.worker_status;

  return {
    timestamp: Date.now(),
    pending: stats?.pending ?? 0,
    processing: stats?.processing ?? 0,
    completed: stats?.completed ?? 0,
    failed: stats?.failed ?? 0,
    deadletter: stats?.deadletter ?? 0,
    activeWorkers: workers?.active ?? 0,
    totalWorkers: workers?.total ?? 0,
    idleWorkers: workers?.idle ?? 0,
  };
}

/**
 * Load stored data from localStorage
 */
function loadStoredData(): TimeseriesPoint[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed: StoredData = JSON.parse(stored);
    if (parsed.version !== STORAGE_VERSION) return [];

    // Filter out old data (keep only last 6 hours)
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    return parsed.points.filter((p) => p.timestamp > sixHoursAgo);
  } catch {
    return [];
  }
}

/**
 * Save data to localStorage
 */
function saveStoredData(points: TimeseriesPoint[]): void {
  try {
    const data: StoredData = {
      version: STORAGE_VERSION,
      points,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage might be full or disabled
  }
}

/**
 * Prune points based on time range configuration
 */
function prunePoints(points: TimeseriesPoint[], timeRange: TimeRange): TimeseriesPoint[] {
  const config = TIME_RANGE_CONFIG[timeRange];
  const cutoff = Date.now() - config.maxPoints * config.intervalMs;

  // Keep points within the time range
  const filtered = points.filter((p) => p.timestamp > cutoff);

  // If still too many points, downsample
  if (filtered.length > config.maxPoints) {
    return filtered.slice(-config.maxPoints);
  }

  return filtered;
}

/**
 * Hook for collecting and accessing dashboard time series data
 */
export function useDashboardTimeseries(
  dashboardData: DashboardData | undefined,
  options: UseDashboardTimeseriesOptions = {}
): UseDashboardTimeseriesReturn {
  const { persist = true, enabled = true } = options;

  // State
  const [points, setPoints] = useState<TimeseriesPoint[]>(() => (persist ? loadStoredData() : []));
  const [timeRange, setTimeRange] = useState<TimeRange>('15m');
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Ref for tracking last sample time
  const lastSampleRef = useRef<number>(0);

  // Sample interval based on time range
  const config = TIME_RANGE_CONFIG[timeRange];

  // Add new point when dashboard data changes
  useEffect(() => {
    if (!enabled || isPaused || !dashboardData) return;

    const now = Date.now();
    const timeSinceLastSample = now - lastSampleRef.current;

    // Only sample at the configured interval
    if (timeSinceLastSample < config.intervalMs) return;

    const newPoint = dashboardToPoint(dashboardData);
    lastSampleRef.current = now;
    setLastUpdated(now);

    setPoints((prev) => {
      const updated = [...prev, newPoint];
      const pruned = prunePoints(updated, timeRange);

      // Persist if enabled
      if (persist) {
        saveStoredData(pruned);
      }

      return pruned;
    });
  }, [dashboardData, enabled, isPaused, config.intervalMs, timeRange, persist]);

  // Prune points when time range changes
  useEffect(() => {
    setPoints((prev) => prunePoints(prev, timeRange));
  }, [timeRange]);

  // Clear history
  const clearHistory = useCallback(() => {
    setPoints([]);
    if (persist) {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLastUpdated(null);
  }, [persist]);

  // Pause/resume
  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  // Derived data for charts
  const backlogTrend = points.map((p) => ({
    timestamp: p.timestamp,
    pending: p.pending,
    processing: p.processing,
    total: p.pending + p.processing,
  }));

  const workerTrend = points.map((p) => ({
    timestamp: p.timestamp,
    active: p.activeWorkers,
    idle: p.idleWorkers,
    total: p.totalWorkers,
  }));

  const failureTrend = points.map((p) => ({
    timestamp: p.timestamp,
    failed: p.failed,
    deadletter: p.deadletter,
  }));

  // Calculate actual duration of collected data
  const collectedDurationMs =
    points.length >= 2 ? points[points.length - 1].timestamp - points[0].timestamp : 0;

  // Expected duration based on time range
  const expectedDurationMs = config.maxPoints * config.intervalMs;

  return {
    points,
    backlogTrend,
    workerTrend,
    failureTrend,
    timeRange,
    setTimeRange,
    isPaused,
    pause,
    resume,
    clearHistory,
    lastUpdated,
    sampleInterval: config.intervalMs,
    pointCount: points.length,
    collectedDurationMs,
    expectedDurationMs,
  };
}
