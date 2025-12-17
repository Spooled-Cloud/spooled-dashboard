/**
 * Trend Chart Components
 *
 * Display time series data from dashboard snapshots.
 * Uses recharts for rendering.
 */

import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

// Color palette matching design system
const COLORS = {
  pending: '#eab308', // yellow-500
  processing: '#3b82f6', // blue-500
  active: '#22c55e', // green-500
  idle: '#64748b', // slate-500
  failed: '#ef4444', // red-500
  deadletter: '#7f1d1d', // red-900
  total: '#6366f1', // indigo-500
};

interface BacklogDataPoint {
  timestamp: number;
  pending: number;
  processing: number;
  total: number;
}

interface WorkerDataPoint {
  timestamp: number;
  active: number;
  idle: number;
  total: number;
}

interface FailureDataPoint {
  timestamp: number;
  failed: number;
  deadletter: number;
}

interface ChartProps<T> {
  data: T[];
  height?: number;
}

// Format timestamp for x-axis
function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'HH:mm');
}

// Custom tooltip formatter
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-2 text-xs text-muted-foreground">
        {label ? format(new Date(label), 'HH:mm:ss') : ''}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/**
 * Backlog Trend Chart - Pending + Processing jobs over time
 */
export const BacklogTrendChart = memo(function BacklogTrendChart({
  data,
  height = 200,
}: ChartProps<BacklogDataPoint>) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Collecting data... ({data.length} sample{data.length !== 1 ? 's' : ''})
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.pending} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.pending} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorProcessing" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.processing} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.processing} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="processing"
          name="Processing"
          stackId="1"
          stroke={COLORS.processing}
          fill="url(#colorProcessing)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="pending"
          name="Pending"
          stackId="1"
          stroke={COLORS.pending}
          fill="url(#colorPending)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/**
 * Worker Availability Trend Chart
 */
export const WorkerTrendChart = memo(function WorkerTrendChart({
  data,
  height = 200,
}: ChartProps<WorkerDataPoint>) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Collecting data... ({data.length} sample{data.length !== 1 ? 's' : ''})
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.active} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.active} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorIdle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.idle} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.idle} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="active"
          name="Active"
          stackId="1"
          stroke={COLORS.active}
          fill="url(#colorActive)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="idle"
          name="Idle"
          stackId="1"
          stroke={COLORS.idle}
          fill="url(#colorIdle)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

/**
 * Failures Trend Chart - Failed + Deadletter jobs over time
 */
export const FailureTrendChart = memo(function FailureTrendChart({
  data,
  height = 200,
}: ChartProps<FailureDataPoint>) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Collecting data... ({data.length} sample{data.length !== 1 ? 's' : ''})
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorDeadletter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.deadletter} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.deadletter} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="failed"
          name="Failed"
          stackId="1"
          stroke={COLORS.failed}
          fill="url(#colorFailed)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="deadletter"
          name="Dead Letter"
          stackId="1"
          stroke={COLORS.deadletter}
          fill="url(#colorDeadletter)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});
