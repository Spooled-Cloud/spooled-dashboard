import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  RefreshCw,
  XCircle,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  CheckCheck,
  ArrowUp,
} from 'lucide-react';
import type { Job, JobStatus } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<JobStatus, string> = {
  pending: 'border-yellow-500 text-yellow-600',
  scheduled: 'border-blue-500 text-blue-600',
  processing: 'bg-blue-500 text-white animate-pulse',
  completed: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-secondary text-secondary-foreground',
  deadletter: 'bg-destructive/80 text-destructive-foreground',
};

interface JobDetailsContentProps {
  jobId: string;
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = statusColors[status] || '';
  return (
    <Badge variant={status === 'processing' ? 'default' : 'outline'} className={config}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
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

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
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
      <pre className="overflow-x-auto rounded-md bg-muted/50 p-4 text-xs">
        <code>{jsonString}</code>
      </pre>
    </div>
  );
}

interface TimelineEvent {
  label: string;
  time: string;
  icon: LucideIcon;
  active: boolean;
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
            icon: Clock,
            active: true,
          },
        ]
      : []),
    ...(job.started_at
      ? [
          {
            label: 'Started',
            time: job.started_at,
            icon: Clock,
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
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      {events.map((event, idx) => (
        <div key={idx} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`rounded-full p-1.5 ${event.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
            >
              <event.icon className="h-3 w-3" />
            </div>
            {idx < events.length - 1 && <div className="mt-1 h-6 w-px bg-border" />}
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-medium">{event.label}</p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(event.time)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function JobDetailsContent({ jobId }: JobDetailsContentProps) {
  const queryClient = useQueryClient();
  const [newPriority, setNewPriority] = useState<number | null>(null);

  const {
    data: job,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => jobsAPI.get(jobId),
    refetchInterval: (query) => {
      const jobData = query.state.data as Job | undefined;
      // Only poll frequently for active jobs, stop polling for terminal states
      if (!jobData) return 5000;
      if (['completed', 'failed', 'cancelled', 'deadletter'].includes(jobData.status)) {
        return false; // Stop polling for terminal states
      }
      return jobData.status === 'processing' ? 3000 : 10000;
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">Failed to load job</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Job not found'}
          </p>
          <Button variant="outline" onClick={() => window.history.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Job Details</h1>
          <p className="font-mono text-sm text-muted-foreground">{formatJobId(job.id)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canRetry && (
            <Button
              size="sm"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate()}
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
              onClick={() => {
                if (confirm('Are you sure you want to delete this job?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <JobStatusBadge status={job.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Queue</p>
                  <Badge variant="outline" className="mt-1">
                    {job.queue}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job Type</p>
                  <p className="mt-1 text-sm font-medium">{job.job_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <p className="mt-1 text-sm font-medium">{job.priority}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attempt</p>
                  <p className="mt-1 text-sm font-medium">
                    {job.attempt} / {job.max_retries}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Backoff Type</p>
                  <p className="mt-1 text-sm font-medium">{job.backoff_type}</p>
                </div>
                {job.timeout_ms && (
                  <div>
                    <p className="text-sm text-muted-foreground">Timeout</p>
                    <p className="mt-1 text-sm font-medium">{job.timeout_ms}ms</p>
                  </div>
                )}
                {job.workflow_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Workflow ID</p>
                    <p className="mt-1 font-mono text-sm font-medium">
                      {formatJobId(job.workflow_id, 12)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {job.error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Error Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="mt-1 font-mono text-sm font-medium">{job.error.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Message</p>
                  <p className="mt-1 text-sm font-medium">{job.error.message}</p>
                </div>
                {job.error.stack && (
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">Stack Trace</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                      <code>{job.error.stack}</code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <JsonDisplay data={job.payload} title="Payload" />
            </CardContent>
          </Card>

          {job.result && (
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonDisplay data={job.result} title="Result" />
              </CardContent>
            </Card>
          )}

          {job.metadata && Object.keys(job.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonDisplay data={job.metadata as Record<string, unknown>} title="Metadata" />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <JobTimeline job={job} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canBoostPriority && (
                <div className="space-y-2 border-b pb-2">
                  <p className="text-sm text-muted-foreground">Boost Priority</p>
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
                      <ArrowUp className="mr-1 h-4 w-4" />
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
                  onClick={() => cancelMutation.mutate()}
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
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this job?')) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Job
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => (window.location.href = '/jobs')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
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
