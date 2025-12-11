/**
 * Dashboard Home Content
 *
 * Main dashboard page with KPIs, charts, and activity
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatNumber, formatPercentage, formatRelativeTime } from '@/lib/utils/format';
import {
  Briefcase,
  Server,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  isLoading?: boolean;
}

function KPICard({ title, value, change, icon, trend, isLoading }: KPICardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-2xl font-bold">{value}</h3>
              {change !== undefined && (
                <div
                  className={`flex items-center text-xs font-medium ${
                    trend === 'up'
                      ? 'text-success'
                      : trend === 'down'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }`}
                >
                  {trend === 'up' ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {change > 0 ? '+' : ''}
                  {change}%
                </div>
              )}
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityIcon({ type }: { type: string }) {
  if (type.includes('completed')) {
    return <CheckCircle className="h-4 w-4 text-success" />;
  }
  if (type.includes('failed')) {
    return <XCircle className="h-4 w-4 text-destructive" />;
  }
  return <AlertCircle className="h-4 w-4 text-info" />;
}

export function DashboardHomeContent() {
  const { data, isLoading, error } = useDashboard();

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Failed to load dashboard</h3>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.job_statistics;
  const workerStatus = data?.worker_status;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your job queue system.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Jobs"
          value={stats ? formatNumber(stats.total) : '0'}
          icon={<Briefcase className="h-6 w-6" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Active Workers"
          value={workerStatus ? `${workerStatus.active}/${workerStatus.total}` : '0/0'}
          icon={<Server className="h-6 w-6" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Jobs"
          value={stats ? formatNumber(stats.pending) : '0'}
          icon={<Layers className="h-6 w-6" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Success Rate"
          value={stats ? formatPercentage(stats.success_rate) : '0%'}
          icon={<CheckCircle className="h-6 w-6" />}
          isLoading={isLoading}
        />
      </div>

      {/* System Info */}
      {data?.system_info && (
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Version:</span>{' '}
                <span className="font-mono">{data.system_info.version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Uptime:</span>{' '}
                <span className="font-medium">
                  {Math.floor(data.system_info.uptime_seconds / 3600)}h{' '}
                  {Math.floor((data.system_info.uptime_seconds % 3600) / 60)}m
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rust Version:</span>{' '}
                <span className="font-mono">{data.system_info.rust_version}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Overview & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Queue Overview</CardTitle>
                <CardDescription>Status of all active queues</CardDescription>
              </div>
              <a href="/queues" className="text-sm text-primary hover:underline">
                View all →
              </a>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : data?.queue_summaries && data.queue_summaries.length > 0 ? (
                <div className="space-y-3">
                  {data.queue_summaries.slice(0, 5).map((queue) => (
                    <div
                      key={queue.name}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{queue.name}</h4>
                          {queue.paused && (
                            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                              Paused
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pending:</span>{' '}
                          <span className="font-medium">{queue.pending}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Processing:</span>{' '}
                          <span className="font-medium">{queue.processing}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>{' '}
                          <span className="font-medium text-destructive">{queue.failed}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">No queues configured</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recent_activity && data.recent_activity.length > 0 ? (
              <div className="space-y-3">
                {data.recent_activity.slice(0, 10).map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <ActivityIcon type={activity.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{activity.type}</p>
                      {activity.job_id && (
                        <p className="font-mono text-xs text-muted-foreground">{activity.job_id}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">No recent activity</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="mt-1 text-2xl font-bold text-success">
                  {formatNumber(stats.completed)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="mt-1 text-2xl font-bold text-destructive">
                  {formatNumber(stats.failed)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="mt-1 text-2xl font-bold text-info">
                  {formatNumber(stats.processing)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Avg. Time</p>
                <p className="mt-1 text-2xl font-bold">{stats.avg_processing_time_ms}ms</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
