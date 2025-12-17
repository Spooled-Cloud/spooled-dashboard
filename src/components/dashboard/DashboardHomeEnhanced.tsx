/**
 * Enhanced Dashboard with Advanced Charts & Visualizations
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatNumber, formatPercentage } from '@/lib/utils/format';
import {
  Briefcase,
  Server,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  Activity,
} from 'lucide-react';
import { JobsOverTimeChart } from './charts/JobsOverTimeChart';
import { StatusDistributionChart } from './charts/StatusDistributionChart';
import { ProcessingRateChart } from './charts/ProcessingRateChart';
import { QueuePerformanceChart } from './charts/QueuePerformanceChart';
import { WorkerUtilizationChart } from './charts/WorkerUtilizationChart';
import { UsageWidget } from '@/components/usage/UsageWidget';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  isLoading?: boolean;
  linkTo?: string;
}

function KPICard({ title, value, change, icon, trend, isLoading, linkTo }: KPICardProps) {
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

  const content = (
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
  );

  if (linkTo) {
    return (
      <a href={linkTo}>
        <Card className="cursor-pointer transition-colors hover:border-primary/50">{content}</Card>
      </a>
    );
  }

  return <Card>{content}</Card>;
}

export function DashboardHomeEnhanced() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">Failed to load dashboard</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.job_statistics;
  const workerStatus = data?.worker_status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Real-time overview of your job queue system</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <Activity className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Jobs"
          value={stats ? formatNumber(stats.total) : '0'}
          icon={<Briefcase className="h-6 w-6" />}
          isLoading={isLoading}
          linkTo="/jobs"
        />
        <KPICard
          title="Active Workers"
          value={workerStatus ? `${workerStatus.active}/${workerStatus.total}` : '0/0'}
          icon={<Server className="h-6 w-6" />}
          isLoading={isLoading}
          linkTo="/workers"
        />
        <KPICard
          title="Pending Jobs"
          value={stats ? formatNumber(stats.pending) : '0'}
          icon={<Layers className="h-6 w-6" />}
          isLoading={isLoading}
          linkTo="/jobs?status=pending"
        />
        <KPICard
          title="Success Rate"
          value={stats ? formatPercentage(stats.success_rate) : '0%'}
          icon={<CheckCircle className="h-6 w-6" />}
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Jobs Over Time
                </CardTitle>
                <CardDescription>Created, completed, and failed jobs (last 24h)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <JobsOverTimeChart timeRange="24h" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>Breakdown of job statuses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : stats ? (
                <StatusDistributionChart
                  data={{
                    pending: stats.pending,
                    scheduled: 0,
                    processing: stats.processing,
                    completed: stats.completed,
                    failed: stats.failed,
                    cancelled: stats.cancelled,
                    deadletter: stats.deadletter,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Processing Rate (Real-Time)</CardTitle>
              <CardDescription>Jobs per second over the last 30 minutes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ProcessingRateChart realtime={true} />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Queue Performance</CardTitle>
                <CardDescription>Throughput comparison across queues</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <QueuePerformanceChart metric="throughput" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Worker Utilization</CardTitle>
                <CardDescription>Active vs. idle capacity</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <WorkerUtilizationChart />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <a
                      key={queue.name}
                      href={`/queues/${queue.name}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:border-primary/50"
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
                    </a>
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
            <CardDescription>Last hour summary</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recent_activity ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Jobs created</div>
                  <div className="mt-1 text-2xl font-bold">
                    {formatNumber(data.recent_activity.jobs_created_1h)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Last 60 minutes</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Jobs completed</div>
                  <div className="mt-1 text-2xl font-bold text-success">
                    {formatNumber(data.recent_activity.jobs_completed_1h)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Last 60 minutes</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs text-muted-foreground">Jobs failed</div>
                  <div className="mt-1 text-2xl font-bold text-destructive">
                    {formatNumber(data.recent_activity.jobs_failed_1h)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Last 60 minutes</div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No activity data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage & Limits */}
      <UsageWidget />
    </div>
  );
}
