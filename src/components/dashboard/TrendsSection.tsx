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
import { Pause, Play, Trash2, Clock, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DashboardData } from '@/lib/types';

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
  } = useDashboardTimeseries(dashboardData);

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
        {/* Status Bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdated
                ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
                : 'No data yet'}
            </span>
            <Badge variant="outline" className="text-xs">
              {pointCount} sample{pointCount !== 1 ? 's' : ''}
            </Badge>
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
          Data is collected locally in your browser and persisted across page reloads. Trend
          accuracy depends on keeping this page open.
        </p>
      </CardContent>
    </Card>
  );
}
