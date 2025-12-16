import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsAPI, getWorkflowStatusInfo, getJobLevels } from '@/lib/api/workflows';
import type { WorkflowWithDetails } from '@/lib/api/workflows';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatDuration } from '@/lib/utils/format';
import {
  RefreshCw,
  GitBranch,
  XCircle,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  ArrowDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import type { Job, JobStatus, WorkflowStatus } from '@/lib/types';
import { toast } from 'sonner';

interface WorkflowDetailsPageProps {
  workflowId: string;
}

function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const info = getWorkflowStatusInfo(status);

  const Icon =
    {
      pending: Clock,
      running: Loader2,
      completed: CheckCircle,
      failed: AlertCircle,
      cancelled: XCircle,
    }[status] || Clock;

  return (
    <Badge variant="outline" className={`${info.color} border-current`}>
      <Icon className={`mr-1 h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {info.label}
    </Badge>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const configs: Record<JobStatus, { color: string; icon: typeof Clock; label: string }> = {
    pending: { color: 'text-gray-600', icon: Clock, label: 'Pending' },
    scheduled: { color: 'text-blue-600', icon: Clock, label: 'Scheduled' },
    processing: { color: 'text-blue-600', icon: Loader2, label: 'Processing' },
    completed: { color: 'text-green-600', icon: CheckCircle, label: 'Completed' },
    failed: { color: 'text-red-600', icon: AlertCircle, label: 'Failed' },
    cancelled: { color: 'text-orange-600', icon: XCircle, label: 'Cancelled' },
    deadletter: { color: 'text-red-800', icon: AlertCircle, label: 'Dead Letter' },
  };

  const config = configs[status] || configs.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} border-current text-xs`}>
      <Icon className={`mr-1 h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}

function JobCard({ job, onClick }: { job: Job; onClick?: () => void }) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:border-primary ${
        job.status === 'completed'
          ? 'border-green-200 bg-green-50/50'
          : job.status === 'failed'
            ? 'border-red-200 bg-red-50/50'
            : job.status === 'processing'
              ? 'border-blue-200 bg-blue-50/50'
              : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="truncate text-sm font-medium">{job.job_type}</span>
          <JobStatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{job.queue}</span>
          {job.completed_at && job.started_at && (
            <>
              <span>•</span>
              <span>
                {formatDuration(
                  new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                )}
              </span>
            </>
          )}
        </div>
        {job.error && <p className="mt-2 truncate text-xs text-destructive">{job.error.message}</p>}
      </CardContent>
    </Card>
  );
}

function WorkflowDiagram({ workflow }: { workflow: WorkflowWithDetails }) {
  const levels = getJobLevels(workflow.jobs, workflow.dependencies);

  return (
    <div className="space-y-4">
      {levels.map((level, levelIndex) => (
        <div key={levelIndex}>
          {levelIndex > 0 && (
            <div className="flex justify-center py-2">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {level.map((job) => (
              <div key={job.id} className="w-64">
                <a href={`/jobs/${job.id}`}>
                  <JobCard job={job} />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ workflow }: { workflow: WorkflowWithDetails }) {
  const { progress } = workflow;
  const total = progress.total || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">
          {progress.completed} of {progress.total} jobs completed
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${(progress.completed / total) * 100}%` }}
        />
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${(progress.processing / total) * 100}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all"
          style={{ width: `${(progress.failed / total) * 100}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Completed ({progress.completed})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Processing ({progress.processing})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Failed ({progress.failed})
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          Pending ({progress.pending})
        </span>
      </div>
    </div>
  );
}

function WorkflowDetailsContent({ workflowId }: WorkflowDetailsPageProps) {
  const queryClient = useQueryClient();

  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId),
    queryFn: () => workflowsAPI.get(workflowId),
    refetchInterval: (query) => {
      const data = query.state.data as WorkflowWithDetails | undefined;
      // Auto-refresh while running
      return data?.status === 'running' ? 2000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => workflowsAPI.cancel(workflowId),
    onSuccess: () => {
      toast.success('Workflow cancelled', { description: 'All pending jobs have been cancelled' });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId) });
    },
    onError: (error) => {
      toast.error('Failed to cancel workflow', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => workflowsAPI.retry(workflowId),
    onSuccess: () => {
      toast.success('Workflow retry started', { description: 'Failed jobs are being reprocessed' });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId) });
    },
    onError: (error) => {
      toast.error('Failed to retry workflow', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleCancel = () => {
    if (confirm('Cancel this workflow? All pending jobs will be cancelled.')) {
      cancelMutation.mutate();
    }
  };

  const handleRetry = () => {
    if (confirm('Retry failed jobs in this workflow?')) {
      retryMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-12 w-12 text-destructive opacity-50" />
        <p className="text-destructive">Failed to load workflow</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Workflow not found'}
        </p>
        <a href="/workflows">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </a>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
              <WorkflowStatusBadge status={workflow.status} />
            </div>
            {workflow.description && (
              <p className="mt-1 text-muted-foreground">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {(workflow.status === 'pending' || workflow.status === 'running') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          {workflow.status === 'failed' && (
            <Button size="sm" onClick={handleRetry} disabled={retryMutation.isPending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Failed
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="text-sm">Total Jobs</span>
            </div>
            <p className="text-2xl font-bold">{workflow.jobs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Created</span>
            </div>
            <p className="text-sm font-medium">{formatRelativeTime(workflow.created_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Play className="h-4 w-4" />
              <span className="text-sm">Started</span>
            </div>
            <p className="text-sm font-medium">
              {workflow.started_at ? formatRelativeTime(workflow.started_at) : 'Not started'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-sm font-medium">
              {workflow.completed_at ? formatRelativeTime(workflow.completed_at) : 'In progress'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6">
          <ProgressBar workflow={workflow} />
        </CardContent>
      </Card>

      {/* Dependency Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Job Dependencies
          </CardTitle>
          <CardDescription>Click on a job to view its details</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <WorkflowDiagram workflow={workflow} />
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {workflow.jobs.map((job, index) => (
              <a
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-sm text-muted-foreground">{index + 1}</span>
                  <div>
                    <p className="font-medium">{job.job_type}</p>
                    <p className="text-sm text-muted-foreground">{job.queue}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <JobStatusBadge status={job.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkflowDetailsPage({ workflowId }: WorkflowDetailsPageProps) {
  return (
    <ProtectedPage>
      <WorkflowDetailsContent workflowId={workflowId} />
    </ProtectedPage>
  );
}
