import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsAPI, getWorkflowStatusInfo } from '@/lib/api/workflows';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  RefreshCw,
  GitBranch,
  XCircle,
  RotateCcw,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateWorkflowDialog } from './CreateWorkflowDialog';
import type { Workflow } from '@/lib/types';

function WorkflowStatusBadge({ status }: { status: Workflow['status'] }) {
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

function WorkflowProgress({ jobs }: { jobs: Workflow['jobs'] }) {
  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const processing = jobs.filter((j) => j.status === 'processing').length;

  const successPercent = (completed / total) * 100;
  const failedPercent = (failed / total) * 100;
  const processingPercent = (processing / total) * 100;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completed} of {total} jobs completed
        </span>
        <span>{Math.round(successPercent)}%</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${successPercent}%` }}
        />
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${processingPercent}%` }}
        />
        <div className="h-full bg-red-500 transition-all" style={{ width: `${failedPercent}%` }} />
      </div>
    </div>
  );
}

function WorkflowsListContent() {
  const queryClient = useQueryClient();

  const {
    data: workflows,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workflows.list({}),
    queryFn: () => workflowsAPI.list(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => workflowsAPI.cancel(id),
    onSuccess: () => {
      toast.success('Workflow cancelled');
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: (error) => {
      toast.error('Failed to cancel workflow', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => workflowsAPI.retry(id),
    onSuccess: () => {
      toast.success('Workflow retry started');
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: (error) => {
      toast.error('Failed to retry workflow', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleCancel = (workflow: Workflow) => {
    if (confirm(`Cancel workflow "${workflow.name}"? All pending jobs will be cancelled.`)) {
      cancelMutation.mutate(workflow.id);
    }
  };

  const handleRetry = (workflow: Workflow) => {
    if (confirm(`Retry failed jobs in workflow "${workflow.name}"?`)) {
      retryMutation.mutate(workflow.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Manage job workflows with dependencies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreateWorkflowDialog
            onSuccess={() => {
              refetch();
            }}
          />
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-purple-500/50 bg-purple-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <GitBranch className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-purple-700">Job Dependency Management</p>
              <p className="text-sm text-purple-600/80">
                Workflows allow you to define job dependencies and execute jobs in the correct
                order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflows List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load workflows</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !workflows || workflows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <GitBranch className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No workflows found</p>
              <p className="text-sm">Create your first workflow to orchestrate dependent jobs</p>
            </div>
          ) : (
            <div className="divide-y">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <a
                          href={`/workflows/${workflow.id}`}
                          className="text-lg font-semibold transition-colors hover:text-primary"
                        >
                          {workflow.name}
                        </a>
                        <WorkflowStatusBadge status={workflow.status} />
                      </div>

                      {workflow.description && (
                        <p className="mb-3 text-sm text-muted-foreground">{workflow.description}</p>
                      )}

                      <div className="mb-4 max-w-md">
                        <WorkflowProgress jobs={workflow.jobs} />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {workflow.jobs.length} jobs
                        </span>
                        <span>Created {formatRelativeTime(workflow.created_at)}</span>
                        {workflow.started_at && (
                          <span>Started {formatRelativeTime(workflow.started_at)}</span>
                        )}
                        {workflow.completed_at && (
                          <span>Completed {formatRelativeTime(workflow.completed_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      {(workflow.status === 'pending' || workflow.status === 'running') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(workflow)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                      {workflow.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(workflow)}
                          disabled={retryMutation.isPending}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retry
                        </Button>
                      )}
                      <a href={`/workflows/${workflow.id}`}>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkflowsListPage() {
  return (
    <ProtectedPage>
      <WorkflowsListContent />
    </ProtectedPage>
  );
}
