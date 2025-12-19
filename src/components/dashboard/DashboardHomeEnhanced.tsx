/**
 * Enhanced Dashboard with Operations Control Center
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatNumber, formatPercentage, formatRelativeTime } from '@/lib/utils/format';
import { getRuntimeConfig } from '@/lib/config/runtime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI } from '@/lib/api/queues';
import { jobsAPI } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';
import {
  Briefcase,
  Server,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  Plus,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  RotateCcw,
  ChevronRight,
  Calendar,
  GitBranch,
  Key,
  Webhook,
  ExternalLink,
  Skull,
} from 'lucide-react';
import { StatusDistributionChart } from './charts/StatusDistributionChart';
import { TrendsSection } from './TrendsSection';
import { UsageWidget } from '@/components/usage/UsageWidget';
import { CreateJobDialog } from '@/components/jobs/CreateJobDialog';
import { CreateQueueDialog } from '@/components/queues/CreateQueueDialog';
import { CreateScheduleDialog } from '@/components/schedules/CreateScheduleDialog';
import { CreateWorkflowDialog } from '@/components/workflows/CreateWorkflowDialog';
import { CreateApiKeyDialog } from '@/components/settings/CreateApiKeyDialog';
import { CreateWebhookDialog } from '@/components/settings/CreateWebhookDialog';
import type { Job } from '@/lib/types';

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

/**
 * Quick Actions Card - Common operations at a glance
 */
function QuickActionsCard() {
  const config = getRuntimeConfig();

  const actions = [
    {
      icon: <Briefcase className="h-4 w-4" />,
      label: 'Create Job',
      dialog: (
        <CreateJobDialog trigger={<ActionButton icon={<Briefcase />} label="Create Job" />} />
      ),
      enabled: true,
    },
    {
      icon: <Layers className="h-4 w-4" />,
      label: 'Create Queue',
      dialog: (
        <CreateQueueDialog trigger={<ActionButton icon={<Layers />} label="Create Queue" />} />
      ),
      enabled: true,
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Create Schedule',
      dialog: config.enableSchedules ? (
        <CreateScheduleDialog
          trigger={<ActionButton icon={<Calendar />} label="Create Schedule" />}
        />
      ) : null,
      enabled: config.enableSchedules,
      tooltip: !config.enableSchedules ? 'Schedules are disabled' : undefined,
    },
    {
      icon: <GitBranch className="h-4 w-4" />,
      label: 'Create Workflow',
      dialog: config.enableWorkflows ? (
        <CreateWorkflowDialog
          trigger={<ActionButton icon={<GitBranch />} label="Create Workflow" />}
        />
      ) : null,
      enabled: config.enableWorkflows,
      tooltip: !config.enableWorkflows ? 'Workflows are disabled' : undefined,
    },
    {
      icon: <Key className="h-4 w-4" />,
      label: 'Create API Key',
      dialog: (
        <CreateApiKeyDialog trigger={<ActionButton icon={<Key />} label="Create API Key" />} />
      ),
      enabled: true,
    },
    {
      icon: <Webhook className="h-4 w-4" />,
      label: 'Create Webhook',
      dialog: (
        <CreateWebhookDialog trigger={<ActionButton icon={<Webhook />} label="Create Webhook" />} />
      ),
      enabled: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
        <CardDescription>Create new resources</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <TooltipProvider>
            {actions.map((action) => (
              <div key={action.label}>
                {action.enabled ? (
                  action.dialog
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <ActionButton icon={action.icon} label={action.label} disabled />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{action.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}

const ActionButton = React.forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ icon, label, disabled = false, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className="h-auto w-full flex-col gap-1 py-3"
      disabled={disabled}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="text-xs">{label}</span>
    </Button>
  );
});
ActionButton.displayName = 'ActionButton';

/**
 * Queues Control Table - Manage queues with pause/resume
 */
function QueuesControlCard() {
  const queryClient = useQueryClient();
  const { data: dashboardData, isLoading } = useDashboard();

  const pauseMutation = useMutation({
    mutationFn: ({ name, reason }: { name: string; reason?: string }) =>
      queuesAPI.pause(name, reason),
    onSuccess: (_, { name }) => {
      toast.success('Queue paused', { description: name });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.all });
    },
    onError: (error) => {
      toast.error('Failed to pause queue', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (name: string) => queuesAPI.resume(name),
    onSuccess: (_, name) => {
      toast.success('Queue resumed', { description: name });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.all });
    },
    onError: (error) => {
      toast.error('Failed to resume queue', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const queues = dashboardData?.queue_summaries || [];

  // Sort by backlog (pending + processing)
  const sortedQueues = [...queues].sort((a, b) => {
    const backlogA = (a.pending || 0) + (a.processing || 0);
    const backlogB = (b.pending || 0) + (b.processing || 0);
    return backlogB - backlogA;
  });

  const topQueues = sortedQueues.slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Queue Operations</CardTitle>
          <CardDescription>Manage queue processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Queue Operations</CardTitle>
          <CardDescription>Top queues by backlog</CardDescription>
        </div>
        <a
          href="/queues"
          className="flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          View all <ChevronRight className="ml-1 h-3 w-3" />
        </a>
      </CardHeader>
      <CardContent>
        {topQueues.length === 0 ? (
          <div className="py-6 text-center">
            <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No queues configured</p>
            <CreateQueueDialog
              trigger={
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="mr-2 h-4 w-4" />
                  Create first queue
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {topQueues.map((queue) => (
              <div
                key={queue.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <a href={`/queues/${queue.name}`} className="font-medium hover:underline">
                    {queue.name}
                  </a>
                  {queue.paused && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      Paused
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="text-yellow-600">{queue.pending || 0}</span> pending
                    </span>
                    <span>
                      <span className="text-blue-600">{queue.processing || 0}</span> processing
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {queue.paused ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => resumeMutation.mutate(queue.name)}
                              disabled={resumeMutation.isPending}
                            >
                              <Play className="h-4 w-4 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Resume queue</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => pauseMutation.mutate({ name: queue.name })}
                              disabled={pauseMutation.isPending}
                            >
                              <Pause className="h-4 w-4 text-yellow-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Pause queue</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a href={`/jobs?queue=${queue.name}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>View jobs</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * DLQ Control Card - Dead letter queue management
 */
function DLQControlCard() {
  const queryClient = useQueryClient();
  const { data: dashboardData, isLoading } = useDashboard();

  const deadletterCount = dashboardData?.job_statistics?.deadletter || 0;

  const retryMutation = useMutation({
    mutationFn: () => jobsAPI.retryDeadLetter({ limit: 100 }),
    onSuccess: (response) => {
      toast.success('DLQ jobs retried', {
        description: `${response.retried_count} job(s) requeued`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => {
      toast.error('Failed to retry DLQ jobs', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () => jobsAPI.purgeDeadLetter({ confirm: true }),
    onSuccess: (response) => {
      toast.success('DLQ purged', {
        description: `${response.purged_count} job(s) deleted`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.overview() });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => {
      toast.error('Failed to purge DLQ', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const handlePurge = () => {
    if (
      confirm(
        `Are you sure you want to permanently delete all ${deadletterCount} dead-letter jobs? This cannot be undone.`
      )
    ) {
      purgeMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={deadletterCount > 0 ? 'border-destructive/50' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skull className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base">Dead Letter Queue</CardTitle>
        </div>
        <CardDescription>Jobs that exhausted all retries</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-destructive">{formatNumber(deadletterCount)}</p>
            <p className="text-xs text-muted-foreground">Jobs in DLQ</p>
          </div>
          {deadletterCount > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry All
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handlePurge}
                disabled={purgeMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Purge
              </Button>
            </div>
          )}
        </div>
        {deadletterCount > 0 && (
          <a
            href="/jobs/dlq"
            className="mt-3 flex items-center text-xs text-muted-foreground hover:text-primary"
          >
            View dead letter queue <ChevronRight className="ml-1 h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Recent Failures Widget - Show latest failed jobs
 */
function RecentFailuresWidget() {
  const { data: failedJobs, isLoading } = useQuery({
    queryKey: queryKeys.jobs.list({ status: ['failed', 'deadletter'], per_page: 5 }),
    queryFn: () =>
      jobsAPI.list({
        status: ['failed', 'deadletter'],
        per_page: 5,
        sort_by: 'created_at',
        sort_order: 'desc',
      }),
    refetchInterval: 30000,
  });

  const queryClient = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => jobsAPI.retry(jobId),
    onSuccess: (job) => {
      toast.success('Job retried', { description: `Job ${job.id.slice(0, 8)}... requeued` });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: (error) => {
      toast.error('Failed to retry job', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Failures</CardTitle>
          <CardDescription>Latest failed jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const jobs = failedJobs?.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Recent Failures</CardTitle>
          <CardDescription>Latest failed jobs</CardDescription>
        </div>
        <a
          href="/jobs?status=failed"
          className="flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          View all <ChevronRight className="ml-1 h-3 w-3" />
        </a>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500/50" />
            <p className="text-sm text-muted-foreground">No recent failures</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job: Job) => (
              <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/jobs/${job.id}`}
                      className="truncate font-mono text-sm hover:underline"
                    >
                      {job.id.slice(0, 8)}...
                    </a>
                    <Badge
                      variant="outline"
                      className={
                        job.status === 'deadletter'
                          ? 'border-red-700 text-red-700'
                          : 'border-red-500 text-red-500'
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {job.job_type} • {job.queue}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(job.created_at)}
                  </span>
                  {job.status === 'failed' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Retry job</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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

      {/* KPI Cards */}
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

      {/* Operations Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <QuickActionsCard />
        <DLQControlCard />
        <RecentFailuresWidget />
      </div>

      {/* Queue Operations */}
      <QueuesControlCard />

      {/* Trends Section */}
      <TrendsSection dashboardData={data} />

      {/* Status Distribution Chart */}
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
                <span className="text-muted-foreground">Environment:</span>{' '}
                <span className="font-mono">{data.system_info.rust_version}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Overview */}
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
                <div className="py-8 text-center">
                  <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No queues configured</p>
                  <CreateQueueDialog
                    trigger={
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="mr-2 h-4 w-4" />
                        Create first queue
                      </Button>
                    }
                  />
                </div>
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
              <div className="space-y-3">
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
