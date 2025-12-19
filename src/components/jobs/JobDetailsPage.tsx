import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { JobStatusBadge } from '@/components/ui/status-badge';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { CopyButton } from '@/components/ui/data-table';
import { SSEIndicator } from '@/components/ui/sse-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { useJobSSE } from '@/lib/hooks/use-sse';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  XCircle,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  CheckCheck,
  ArrowUp,
  GitBranch,
  Loader2,
  Play,
  Pause,
} from 'lucide-react';
import type { Job } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

interface JobDetailsContentProps {
  jobId: string;
}

function JsonDisplay({
  data,
  title,
}: {
  data: Record<string, unknown> | undefined;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!data || Object.keys(data).length === 0) {
    return <div className="text-sm text-muted-foreground">No {title.toLowerCase()} available</div>;
  }

  const jsonString = JSON.stringify(data, null, 2);
  const sizeKB = new TextEncoder().encode(jsonString).length / 1024;
  const isLarge = sizeKB > 50;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{title}</h4>
          <span className="text-xs text-muted-foreground">({sizeKB.toFixed(1)} KB)</span>
          {isLarge && (
            <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-600">
              Large payload
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <CheckCheck className="mr-1 h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </div>
      <pre
        className={`overflow-x-auto rounded-lg border bg-muted/30 p-4 text-xs ${isLarge ? 'max-h-96' : ''}`}
      >
        <code className="font-mono">{jsonString}</code>
      </pre>
    </div>
  );
}

interface TimelineEvent {
  label: string;
  time: string;
  icon: LucideIcon;
  active: boolean;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

function JobTimeline({ job }: { job: Job }) {
  const events: TimelineEvent[] = [
    {
      label: 'Created',
      time: job.created_at,
      icon: Clock,
      active: true,
    },
    ...(job.scheduled_at
      ? [
          {
            label: 'Scheduled',
            time: job.scheduled_at,
            icon: Pause,
            active: true,
          },
        ]
      : []),
    ...(job.started_at
      ? [
          {
            label: 'Started',
            time: job.started_at,
            icon: Play,
            active: true,
          },
        ]
      : []),
    ...(job.completed_at
      ? [
          {
            label: 'Completed',
            time: job.completed_at,
            icon: CheckCircle,
            active: true,
            variant: 'success' as const,
          },
        ]
      : []),
    ...(job.failed_at
      ? [
          {
            label: 'Failed',
            time: job.failed_at,
            icon: AlertCircle,
            active: true,
            variant: 'danger' as const,
          },
        ]
      : []),
    ...(job.next_retry_at
      ? [
          {
            label: 'Next Retry',
            time: job.next_retry_at,
            icon: RefreshCw,
            active: false,
            variant: 'warning' as const,
          },
        ]
      : []),
  ];

  const variantColors = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    danger: 'bg-red-500/10 text-red-600',
    warning: 'bg-amber-500/10 text-amber-600',
  };

  return (
    <div className="space-y-3">
      {events.map((event, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex gap-3"
        >
          <div className="flex flex-col items-center">
            <div
              className={`rounded-full p-1.5 ${
                event.active
                  ? variantColors[event.variant || 'default']
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <event.icon className="h-3 w-3" />
            </div>
            {idx < events.length - 1 && <div className="mt-1 h-6 w-px bg-border" />}
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(event.time)}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function JobDependenciesPanel({ jobId }: { jobId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['job-dependencies', jobId],
    queryFn: () => jobsAPI.getDependencies(jobId),
    retry: false,
    staleTime: 30000,
  });

  if (isLoading) {
    return <Skeleton className="h-24" />;
  }

  if (error || !data) {
    return null; // Hide if no dependencies
  }

  if (data.depends_on.length === 0 && data.depended_by.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Dependencies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.depends_on.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Depends on ({data.depends_on.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {data.depends_on.map((id) => (
                <a
                  key={id}
                  href={`/jobs/${id}`}
                  className="inline-flex items-center rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/80"
                >
                  {formatJobId(id, 8)}
                </a>
              ))}
            </div>
          </div>
        )}
        {data.depended_by.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Dependents ({data.depended_by.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {data.depended_by.map((id) => (
                <a
                  key={id}
                  href={`/jobs/${id}`}
                  className="inline-flex items-center rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/80"
                >
                  {formatJobId(id, 8)}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">All dependencies met:</span>
          {data.all_dependencies_met ? (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Yes
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              <Clock className="mr-1 h-3 w-3" />
              Waiting
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JobDetailsContent({ jobId }: JobDetailsContentProps) {
  const queryClient = useQueryClient();
  const [newPriority, setNewPriority] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const {
    data: job,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => jobsAPI.get(jobId),
    refetchInterval: (query) => {
      const jobData = query.state.data as Job | undefined;
      if (!jobData) return 5000;
      if (['completed', 'failed', 'cancelled', 'deadletter'].includes(jobData.status)) {
        return false;
      }
      // With SSE connected, poll less frequently as backup
      return sseConnected ? 30000 : jobData.status === 'processing' ? 3000 : 10000;
    },
  });

  // SSE for real-time updates (only for non-terminal states)
  const isTerminalState =
    job && ['completed', 'failed', 'cancelled', 'deadletter'].includes(job.status);
  const {
    isConnected: sseConnected,
    isConnecting: sseConnecting,
    error: sseError,
    reconnect: sseReconnect,
  } = useJobSSE(jobId, {
    enabled: !isTerminalState,
    onEvent: (event) => {
      // Refetch job data when we receive an update
      if (
        event.type === 'job_status_changed' ||
        event.type === 'job_completed' ||
        event.type === 'job_failed'
      ) {
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      }
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => jobsAPI.retry(jobId),
    onSuccess: () => {
      toast.success('Job queued for retry', {
        description: 'Job has been reset and will be processed again',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    },
    onError: (error) => {
      toast.error('Failed to retry job', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => jobsAPI.cancel(jobId),
    onSuccess: () => {
      toast.success('Job cancelled');
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      setShowCancelDialog(false);
    },
    onError: (error) => {
      toast.error('Failed to cancel job', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => jobsAPI.delete(jobId),
    onSuccess: () => {
      toast.success('Job deleted');
      window.location.href = '/jobs';
    },
    onError: (error) => {
      toast.error('Failed to delete job', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const boostPriorityMutation = useMutation({
    mutationFn: (priority: number) => jobsAPI.boostPriority(jobId, priority),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
      toast.success('Priority updated', {
        description: `Changed from ${data.old_priority} to ${data.new_priority}`,
      });
      setNewPriority(null);
    },
    onError: (error) => {
      toast.error('Failed to update priority', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const canRetry = job?.status === 'failed' || job?.status === 'deadletter';
  const canCancel = job?.status === 'pending' || job?.status === 'scheduled';
  const canDelete =
    job?.status === 'completed' || job?.status === 'failed' || job?.status === 'cancelled';
  const canBoostPriority = job?.status === 'pending' || job?.status === 'scheduled';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <InlineError
        title="Failed to load job"
        error={error || 'Job not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Details"
        backHref="/jobs"
        backLabel="Back to Jobs"
        actions={
          <>
            {!isTerminalState && (
              <SSEIndicator
                isConnected={sseConnected}
                isConnecting={sseConnecting}
                error={sseError}
                onReconnect={sseReconnect}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canRetry && (
              <Button
                size="sm"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        }
      >
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{formatJobId(job.id)}</span>
          <CopyButton value={job.id} />
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <JobStatusBadge status={job.status} />
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Queue</p>
                  <Badge variant="outline" className="mt-1">
                    {job.queue}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Job Type</p>
                  <p className="mt-1 text-sm font-medium">{job.job_type || 'N/A'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Priority</p>
                  <p className="mt-1 text-lg font-semibold">{job.priority}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Attempt</p>
                  <p className="mt-1 text-lg font-semibold">
                    {job.attempt}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {job.max_retries}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Timeout</p>
                  <p className="mt-1 text-sm font-medium">
                    {job.timeout_ms ? `${Math.round(job.timeout_ms / 1000)}s` : 'N/A'}
                  </p>
                </div>
                {job.workflow_id && (
                  <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Workflow ID</p>
                    <a
                      href={`/workflows/${job.workflow_id}`}
                      className="mt-1 inline-flex items-center gap-1 font-mono text-sm font-medium hover:text-primary"
                    >
                      {formatJobId(job.workflow_id, 16)}
                      <CopyButton value={job.workflow_id} />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Details */}
          <AnimatePresence>
            {job.error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Error Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg bg-destructive/5 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Type</p>
                      <p className="mt-1 font-mono text-sm font-medium">{job.error.type}</p>
                    </div>
                    <div className="rounded-lg bg-destructive/5 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Message</p>
                      <p className="mt-1 text-sm font-medium">{job.error.message}</p>
                    </div>
                    {job.error.stack && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Stack Trace
                        </p>
                        <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
                          <code className="font-mono">{job.error.stack}</code>
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payload */}
          <Card>
            <CardHeader>
              <CardTitle>Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonDisplay data={job.payload} title="Payload" />
            </CardContent>
          </Card>

          {/* Result */}
          {job.result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                  Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <JsonDisplay data={job.result} title="Result" />
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          {job.metadata && Object.keys(job.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata / Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonDisplay data={job.metadata as Record<string, unknown>} title="Metadata" />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <JobTimeline job={job} />
            </CardContent>
          </Card>

          {/* Dependencies */}
          <JobDependenciesPanel jobId={jobId} />

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canBoostPriority && (
                <div className="space-y-2 border-b pb-3">
                  <p className="text-sm font-medium">Boost Priority</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={-100}
                      max={100}
                      value={newPriority ?? job?.priority ?? 0}
                      onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newPriority !== null && newPriority !== job?.priority) {
                          boostPriorityMutation.mutate(newPriority);
                        }
                      }}
                      disabled={boostPriorityMutation.isPending || newPriority === job?.priority}
                    >
                      {boostPriorityMutation.isPending ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="mr-1 h-4 w-4" />
                      )}
                      Update
                    </Button>
                  </div>
                </div>
              )}
              {canRetry && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Job
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Job
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Job
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Confirmation */}
      <DangerConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Job"
        description="Are you sure you want to cancel this job? This action cannot be undone."
        confirmLabel="Cancel Job"
        isLoading={cancelMutation.isPending}
        warnings={['Job will be marked as cancelled', 'Any pending retries will be stopped']}
      />

      {/* Delete Confirmation */}
      <DangerConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Job"
        description="Are you sure you want to permanently delete this job?"
        confirmText="DELETE"
        confirmLabel="Delete Job"
        isLoading={deleteMutation.isPending}
        warnings={['Job data will be permanently deleted', 'This action cannot be undone']}
      />
    </div>
  );
}

export function JobDetailsPage({ jobId }: { jobId: string }) {
  return (
    <ProtectedPage>
      <JobDetailsContent jobId={jobId} />
    </ProtectedPage>
  );
}
