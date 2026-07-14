/**
 * Dashboard Home — Operational Command Center
 *
 * Incident-oriented layout: abnormal signals (paused queues, backlog
 * concentration, unhealthy workers, DLQ, elevated failure rate) surface
 * first. Everything else is organized as flat, ruled bands rather than a
 * grid of equal-weight KPI cards, with explicit time windows/units so
 * "right now" is never confused with a windowed total.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { formatNumber, formatRelativeTime, formatDuration } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { getRuntimeConfig } from '@/lib/config/runtime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI } from '@/lib/api/queues';
import { jobsAPI } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';
import {
  Briefcase,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
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
  Database,
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
import type { Job, DashboardData } from '@/lib/types';

/** Re-render periodically so relative "last updated" text stays fresh. */
function useTick(intervalMs: number) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

// ============================================================================
// Incident signals — computed from live backend fields only
// ============================================================================

type SignalSeverity = 'critical' | 'warning';

interface Signal {
  id: string;
  severity: SignalSeverity;
  message: string;
  href: string;
}

function computeSignals(data: DashboardData | undefined): Signal[] {
  if (!data) return [];
  const signals: Signal[] = [];

  const deadletter = data.jobs?.deadletter ?? 0;
  if (deadletter > 0) {
    signals.push({
      id: 'dlq',
      severity: 'critical',
      message: `${formatNumber(deadletter)} job${deadletter === 1 ? '' : 's'} stuck in the dead-letter queue`,
      href: '/jobs/dlq',
    });
  }

  const unhealthyWorkers = data.workers?.unhealthy ?? 0;
  if (unhealthyWorkers > 0) {
    signals.push({
      id: 'workers',
      severity: 'critical',
      message: `${unhealthyWorkers} worker${unhealthyWorkers === 1 ? '' : 's'} unhealthy`,
      href: '/workers',
    });
  }

  const pausedQueues = (data.queues ?? []).filter((q) => q.paused);
  if (pausedQueues.length > 0) {
    const names = pausedQueues
      .slice(0, 3)
      .map((q) => q.name)
      .join(', ');
    signals.push({
      id: 'paused-queues',
      severity: 'warning',
      message: `${pausedQueues.length} queue${pausedQueues.length === 1 ? '' : 's'} paused (${names}${pausedQueues.length > 3 ? '…' : ''})`,
      href: '/queues',
    });
  }

  const completed24h = data.jobs?.completed_24h ?? 0;
  const failed24h = data.jobs?.failed_24h ?? 0;
  const totalProcessed24h = completed24h + failed24h;
  const failureRate = totalProcessed24h > 0 ? (failed24h / totalProcessed24h) * 100 : 0;
  if (totalProcessed24h >= 10 && failureRate >= 5) {
    signals.push({
      id: 'failure-rate',
      severity: failureRate >= 15 ? 'critical' : 'warning',
      message: `${failureRate.toFixed(1)}% failure rate over 24h (${formatNumber(failed24h)} of ${formatNumber(totalProcessed24h)})`,
      href: '/jobs?status=failed',
    });
  }

  const totalPending = data.jobs?.pending ?? 0;
  const busiestQueue = [...(data.queues ?? [])].sort(
    (a, b) => b.pending + b.processing - (a.pending + a.processing)
  )[0];
  if (busiestQueue && totalPending >= 20 && busiestQueue.pending / totalPending >= 0.6) {
    signals.push({
      id: 'backlog',
      severity: 'warning',
      message: `Backlog concentrated in "${busiestQueue.name}" (${formatNumber(busiestQueue.pending)} pending)`,
      href: `/jobs?queue=${busiestQueue.name}&status=pending`,
    });
  }

  return signals;
}

function IncidentBand({ signals, isLoading }: { signals: Signal[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-12 w-full" />;
  }

  if (signals.length === 0) {
    return (
      <div className="border-status-completed/30 bg-status-completed/5 flex items-center gap-2 rounded-sm border px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-completed" />
        <span className="font-medium text-status-completed-foreground">All systems normal</span>
        <span className="text-muted-foreground">— no active incidents detected</span>
      </div>
    );
  }

  return (
    <div
      className="divide-y divide-border overflow-hidden rounded-sm border border-border"
      role="alert"
    >
      {signals.map((signal) => (
        <a
          key={signal.id}
          href={signal.href}
          className={cn(
            'hover:bg-muted/40 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors',
            signal.severity === 'critical' ? 'bg-status-failed/5' : 'bg-status-warning/5'
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangle
              className={cn(
                'h-4 w-4 shrink-0',
                signal.severity === 'critical' ? 'text-status-failed' : 'text-status-warning'
              )}
            />
            <span
              className={cn(
                'truncate font-medium',
                signal.severity === 'critical'
                  ? 'text-status-failed-foreground'
                  : 'text-status-warning-foreground'
              )}
            >
              {signal.message}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}

// ============================================================================
// Compact quick actions — de-emphasized icon strip (dialogs unchanged)
// ============================================================================

function QuickActionsStrip() {
  const config = getRuntimeConfig();

  const actions = [
    {
      key: 'job',
      label: 'Create Job',
      icon: <Briefcase className="h-4 w-4" />,
      node: (
        <CreateJobDialog trigger={<QuickActionButton icon={<Briefcase />} label="Create Job" />} />
      ),
      enabled: true,
    },
    {
      key: 'queue',
      label: 'Create Queue',
      icon: <Layers className="h-4 w-4" />,
      node: (
        <CreateQueueDialog trigger={<QuickActionButton icon={<Layers />} label="Create Queue" />} />
      ),
      enabled: true,
    },
    {
      key: 'schedule',
      label: 'Create Schedule',
      icon: <Calendar className="h-4 w-4" />,
      node: config.enableSchedules ? (
        <CreateScheduleDialog
          trigger={<QuickActionButton icon={<Calendar />} label="Create Schedule" />}
        />
      ) : null,
      enabled: config.enableSchedules,
      disabledReason: 'Schedules are disabled',
    },
    {
      key: 'workflow',
      label: 'Create Workflow',
      icon: <GitBranch className="h-4 w-4" />,
      node: config.enableWorkflows ? (
        <CreateWorkflowDialog
          trigger={<QuickActionButton icon={<GitBranch />} label="Create Workflow" />}
        />
      ) : null,
      enabled: config.enableWorkflows,
      disabledReason: 'Workflows are disabled',
    },
    {
      key: 'api-key',
      label: 'Create API Key',
      icon: <Key className="h-4 w-4" />,
      node: (
        <CreateApiKeyDialog trigger={<QuickActionButton icon={<Key />} label="Create API Key" />} />
      ),
      enabled: true,
    },
    {
      key: 'webhook',
      label: 'Create Webhook',
      icon: <Webhook className="h-4 w-4" />,
      node: (
        <CreateWebhookDialog
          trigger={<QuickActionButton icon={<Webhook />} label="Create Webhook" />}
        />
      ),
      enabled: true,
    },
  ];

  return (
    <TooltipProvider>
      <div className="flex shrink-0 items-center gap-1">
        {actions.map((action) =>
          action.enabled ? (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <span>{action.node}</span>
              </TooltipTrigger>
              <TooltipContent>{action.label}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <span>
                  <QuickActionButton icon={action.icon} label={action.label} disabled />
                </span>
              </TooltipTrigger>
              <TooltipContent>{action.disabledReason}</TooltipContent>
            </Tooltip>
          )
        )}
      </div>
    </TooltipProvider>
  );
}

const QuickActionButton = React.forwardRef<
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
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      aria-label={label}
      {...props}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
    </Button>
  );
});
QuickActionButton.displayName = 'QuickActionButton';

// ============================================================================
// Stat rows — flat label/value rules instead of nested cards
// ============================================================================

interface StatRowProps {
  label: string;
  value: string;
  caption?: string;
  href?: string;
  tone?: 'default' | 'failed' | 'warning' | 'completed';
  isLoading?: boolean;
}

function StatRow({ label, value, caption, href, tone = 'default', isLoading }: StatRowProps) {
  const toneClass =
    tone === 'failed'
      ? 'text-status-failed-foreground'
      : tone === 'warning'
        ? 'text-status-warning-foreground'
        : tone === 'completed'
          ? 'text-status-completed-foreground'
          : 'text-foreground';

  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  const content = (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn('text-base font-semibold tabular-nums', toneClass)}>{value}</span>
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
      </span>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="hover:bg-muted/40 block transition-colors">
        {content}
      </a>
    );
  }

  return content;
}

function StatPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

// ============================================================================
// Dead-letter queue action bar
// ============================================================================

function DeadLetterActionBar() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDashboard();
  const deadletterCount = data?.jobs?.deadletter ?? 0;

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
    return <Skeleton className="h-12 w-full" />;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-sm border px-4 py-2.5',
        deadletterCount > 0 ? 'border-status-failed/30 bg-status-failed/5' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <Skull
          className={cn(
            'h-4 w-4 shrink-0',
            deadletterCount > 0 ? 'text-status-failed' : 'text-muted-foreground'
          )}
        />
        <span className="font-medium">Dead-letter queue</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            deadletterCount > 0 ? 'text-status-failed-foreground' : 'text-muted-foreground'
          )}
        >
          {formatNumber(deadletterCount)}
        </span>
        <a
          href="/jobs/dlq"
          className="flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          View <ChevronRight className="ml-0.5 h-3 w-3" />
        </a>
      </div>
      {deadletterCount > 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Retry all
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handlePurge}
            disabled={purgeMutation.isPending}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Purge
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Queues panel — flat table, sorted by backlog, with pause/resume controls
// ============================================================================

function QueuesPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useDashboard();

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

  const queues = data?.queues ?? [];
  const sortedQueues = [...queues].sort(
    (a, b) => b.pending + b.processing - (a.pending + a.processing)
  );
  const topQueues = sortedQueues.slice(0, 6);

  return (
    <div className="rounded-sm border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Queues — by backlog
        </span>
        <a
          href="/queues"
          className="flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          View all <ChevronRight className="ml-1 h-3 w-3" />
        </a>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : topQueues.length === 0 ? (
        <EmptyState
          title="No queues configured"
          icon={Layers}
          compact
          action={
            <CreateQueueDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create first queue
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {topQueues.map((queue) => (
            <div key={queue.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <a
                  href={`/queues/${queue.name}`}
                  className="truncate font-medium hover:text-primary hover:underline"
                >
                  {queue.name}
                </a>
                {queue.paused && (
                  <Badge
                    variant="outline"
                    className="border-status-warning/50 bg-status-warning/10 shrink-0 text-status-warning-foreground"
                  >
                    Paused
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="flex gap-4 text-xs tabular-nums text-muted-foreground">
                  <span>
                    <span className="font-medium text-status-pending-foreground">
                      {formatNumber(queue.pending)}
                    </span>{' '}
                    pending
                  </span>
                  <span>
                    <span className="font-medium text-status-processing-foreground">
                      {formatNumber(queue.processing)}
                    </span>{' '}
                    processing
                  </span>
                </div>
                <div className="flex gap-1">
                  <TooltipProvider>
                    {queue.paused ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => resumeMutation.mutate(queue.name)}
                            disabled={resumeMutation.isPending}
                          >
                            <Play className="h-4 w-4 text-status-completed" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resume queue</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => pauseMutation.mutate({ name: queue.name })}
                            disabled={pauseMutation.isPending}
                          >
                            <Pause className="h-4 w-4 text-status-warning" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pause queue</TooltipContent>
                      </Tooltip>
                    )}
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
    </div>
  );
}

// ============================================================================
// Recent failures panel
// ============================================================================

function RecentFailuresPanel() {
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

  const jobs = failedJobs?.data || [];

  return (
    <div className="rounded-sm border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent failures
        </span>
        <a
          href="/jobs?status=failed"
          className="flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          View all <ChevronRight className="ml-1 h-3 w-3" />
        </a>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState title="No recent failures" icon={CheckCircle2} compact />
      ) : (
        <div className="divide-y divide-border">
          {jobs.map((job: Job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
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
                        ? 'border-status-failed/60 bg-status-failed/10 shrink-0 text-status-failed-foreground'
                        : 'border-status-failed/40 bg-status-failed/5 shrink-0 text-status-failed-foreground'
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {job.job_type} • {job.queue}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted-foreground">
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
    </div>
  );
}

// ============================================================================
// Loading skeleton for the whole page
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ============================================================================
// Main
// ============================================================================

export function DashboardHomeEnhanced() {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useDashboard();
  useTick(15000);

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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const jobs = data?.jobs;
  const workers = data?.workers;
  const queues = data?.queues ?? [];
  const recentActivity = data?.recent_activity;
  const system = data?.system;
  const pausedCount = queues.filter((q) => q.paused).length;
  const signals = computeSignals(data);

  const freshnessLabel = dataUpdatedAt ? formatRelativeTime(new Date(dataUpdatedAt)) : 'never';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot updated <span className="tabular-nums">{freshnessLabel}</span>
            {isFetching && ' · refreshing…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickActionsStrip />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <Activity className={cn('mr-2 h-4 w-4', isFetching && 'animate-pulse')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Incident detection — highest priority, first thing an operator sees */}
      <IncidentBand signals={signals} isLoading={isLoading} />

      {/* Dead-letter queue — always visible, actionable when non-empty */}
      <DeadLetterActionBar />

      {/* Current state vs. windowed totals — explicit units, no equal-weight KPI grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatPanel title="Current state">
          <StatRow
            label="Pending"
            value={jobs ? formatNumber(jobs.pending) : '—'}
            href="/jobs?status=pending"
          />
          <StatRow
            label="Processing"
            value={jobs ? formatNumber(jobs.processing) : '—'}
            href="/jobs?status=processing"
          />
          <StatRow
            label="Workers healthy"
            value={
              workers ? `${formatNumber(workers.healthy)} / ${formatNumber(workers.total)}` : '—'
            }
            tone={workers && workers.unhealthy > 0 ? 'warning' : 'completed'}
            href="/workers"
          />
          <StatRow
            label="Queues paused"
            value={`${pausedCount} / ${queues.length}`}
            tone={pausedCount > 0 ? 'warning' : 'default'}
            href="/queues"
          />
          <StatRow
            label="Dead-letter"
            value={jobs ? formatNumber(jobs.deadletter) : '—'}
            tone={jobs && jobs.deadletter > 0 ? 'failed' : 'default'}
            href="/jobs/dlq"
          />
        </StatPanel>

        <StatPanel title="Windowed activity">
          <StatRow
            label="Created"
            value={recentActivity ? formatNumber(recentActivity.jobs_created_1h) : '—'}
            caption="last 1h"
            href="/jobs"
          />
          <StatRow
            label="Completed"
            value={recentActivity ? formatNumber(recentActivity.jobs_completed_1h) : '—'}
            caption="last 1h"
            tone="completed"
            href="/jobs?status=completed"
          />
          <StatRow
            label="Failed"
            value={recentActivity ? formatNumber(recentActivity.jobs_failed_1h) : '—'}
            caption="last 1h"
            tone={recentActivity && recentActivity.jobs_failed_1h > 0 ? 'failed' : 'default'}
            href="/jobs?status=failed"
          />
          <StatRow
            label="Completed"
            value={jobs ? formatNumber(jobs.completed_24h) : '—'}
            caption="last 24h"
            href="/jobs?status=completed"
          />
          <StatRow
            label="Failed"
            value={jobs ? formatNumber(jobs.failed_24h) : '—'}
            caption="last 24h"
            tone={jobs && jobs.failed_24h > 0 ? 'failed' : 'default'}
            href="/jobs?status=failed"
          />
          <StatRow
            label="Avg wait"
            value={jobs?.avg_wait_time_ms != null ? formatDuration(jobs.avg_wait_time_ms) : '—'}
          />
          <StatRow
            label="Avg processing"
            value={
              jobs?.avg_processing_time_ms != null
                ? formatDuration(jobs.avg_processing_time_ms)
                : '—'
            }
          />
        </StatPanel>
      </div>

      {/* Queues by backlog */}
      <QueuesPanel />

      {/* Recent failures */}
      <RecentFailuresPanel />

      {/* Trends (client-sampled) */}
      <TrendsSection dashboardData={data} />

      {/* Status distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Status distribution</CardTitle>
          <CardDescription>Breakdown of current + 24h job statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {jobs ? (
              <StatusDistributionChart
                data={{
                  pending: jobs.pending,
                  processing: jobs.processing,
                  completed: jobs.completed_24h,
                  failed: jobs.failed_24h,
                  deadletter: jobs.deadletter,
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

      {/* Diagnostics — compact, not hero */}
      {system && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-border px-4 py-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>
            v<span className="font-mono">{system.version}</span>
          </span>
          <span>
            uptime{' '}
            <span className="tabular-nums">
              {Math.floor(system.uptime_seconds / 3600)}h{' '}
              {Math.floor((system.uptime_seconds % 3600) / 60)}m
            </span>
          </span>
          <span className="font-mono">{system.environment}</span>
          <span
            className={cn(
              system.database_status.toLowerCase() === 'ok' ||
                system.database_status.toLowerCase() === 'healthy'
                ? 'text-status-completed-foreground'
                : 'text-status-warning-foreground'
            )}
          >
            db: {system.database_status}
          </span>
          <span
            className={cn(
              system.cache_status.toLowerCase() === 'ok' ||
                system.cache_status.toLowerCase() === 'healthy'
                ? 'text-status-completed-foreground'
                : 'text-status-warning-foreground'
            )}
          >
            cache: {system.cache_status}
          </span>
        </div>
      )}

      {/* Usage & limits */}
      <UsageWidget />
    </div>
  );
}
