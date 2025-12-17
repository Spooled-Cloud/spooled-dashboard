/**
 * Trends Section Component
 *
 * Displays time series charts with user controls for time range,
 * pause/resume, and data management.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardTimeseries, type TimeRange } from '@/lib/hooks/useDashboardTimeseries';
import { BacklogTrendChart, WorkerTrendChart, FailureTrendChart } from './charts/TrendCharts';
import { Pause, Play, Trash2, Clock, Activity, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DashboardData } from '@/lib/types';

/** Format duration in a human-readable way */
function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.round((ms % 3600000) / 60000);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

interface TrendsSectionProps {
  dashboardData: DashboardData | undefined;
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '15m': '15 minutes',
  '1h': '1 hour',
  '6h': '6 hours',
};

export function TrendsSection({ dashboardData }: TrendsSectionProps) {
  const {
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
    sampleInterval,
    pointCount,
    collectedDurationMs,
    expectedDurationMs,
  } = useDashboardTimeseries(dashboardData);

  // Check if we have enough data for the selected time range
  const hasInsufficientData = collectedDurationMs < expectedDurationMs * 0.5; // Less than 50% of expected
  const coveragePercent = Math.min(
    100,
    Math.round((collectedDurationMs / expectedDurationMs) * 100)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trends (Sampled)
          </CardTitle>
          <CardDescription>
            Client-side snapshots collected every {sampleInterval / 1000}s
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_RANGE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pause/Resume */}
          <Button
            variant="outline"
            size="icon"
            onClick={isPaused ? resume : pause}
            title={isPaused ? 'Resume sampling' : 'Pause sampling'}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          {/* Clear History */}
          <Button variant="outline" size="icon" onClick={clearHistory} title="Clear history">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Insufficient Data Alert */}
        {hasInsufficientData && pointCount > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <span className="font-medium">Limited data for {TIME_RANGE_LABELS[timeRange]}:</span>{' '}
              You have {formatDuration(collectedDurationMs)} of data ({coveragePercent}% coverage).
              Keep this page open to collect more samples.
            </div>
          </div>
        )}

        {pointCount === 0 && (
          <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-600 dark:text-blue-400">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <span className="font-medium">Collecting data...</span> Samples are taken every{' '}
              {sampleInterval / 1000}s. Keep this page open to build trend history.
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdated
                ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
                : 'Waiting for first sample...'}
            </span>
            {pointCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {formatDuration(collectedDurationMs)} of data ({pointCount} sample
                {pointCount !== 1 ? 's' : ''})
              </Badge>
            )}
          </div>
          {isPaused && (
            <Badge variant="secondary" className="text-xs">
              Paused
            </Badge>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Backlog Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Backlog</CardTitle>
              <CardDescription className="text-xs">Pending + Processing jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <BacklogTrendChart data={backlogTrend} height={180} />
            </CardContent>
          </Card>

          {/* Worker Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Workers</CardTitle>
              <CardDescription className="text-xs">Active vs Idle workers</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkerTrendChart data={workerTrend} height={180} />
            </CardContent>
          </Card>

          {/* Failures Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failures</CardTitle>
              <CardDescription className="text-xs">Failed + Dead letter jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <FailureTrendChart data={failureTrend} height={180} />
            </CardContent>
          </Card>
        </div>

        {/* Data Note */}
        <p className="text-center text-xs text-muted-foreground">
          📊 Trends are built from client-side snapshots collected while this page is open. Data
          persists in localStorage across reloads (up to 6 hours).
        </p>
      </CardContent>
    </Card>
  );
}
