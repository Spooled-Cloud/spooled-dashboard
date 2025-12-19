import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { QueueStatusBadge } from '@/components/ui/status-badge';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { DataTableLoading } from '@/components/ui/data-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI } from '@/lib/api/queues';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { RefreshCw, Pause, Play, Trash2, Settings, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { CreateQueueDialog } from './CreateQueueDialog';
import type { Queue } from '@/lib/types';

function QueuesListContent() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [queueToDelete, setQueueToDelete] = useState<string | null>(null);
  const [deleteJobs, setDeleteJobs] = useState(false);

  const {
    data: queues,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.queues.list(),
    queryFn: () => queuesAPI.list(),
    refetchInterval: 10000,
  });

  const pauseMutation = useMutation({
    mutationFn: (name: string) => queuesAPI.pause(name),
    onSuccess: (_, name) => {
      toast.success('Queue paused', { description: `Queue "${name}" is now paused` });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
    },
    onError: (error, name) => {
      toast.error('Failed to pause queue', {
        description: error instanceof Error ? error.message : `Could not pause "${name}"`,
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (name: string) => queuesAPI.resume(name),
    onSuccess: (_, name) => {
      toast.success('Queue resumed', { description: `Queue "${name}" is now processing jobs` });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
    },
    onError: (error, name) => {
      toast.error('Failed to resume queue', {
        description: error instanceof Error ? error.message : `Could not resume "${name}"`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ name, deleteJobs: del }: { name: string; deleteJobs: boolean }) =>
      queuesAPI.delete(name, del),
    onSuccess: (_, { name }) => {
      toast.success('Queue deleted', { description: `Queue "${name}" has been removed` });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
      setDeleteDialogOpen(false);
      setQueueToDelete(null);
    },
    onError: (error) => {
      toast.error('Failed to delete queue', {
        description: error instanceof Error ? error.message : 'Could not delete queue',
      });
    },
  });

  const handleTogglePause = (queue: Queue) => {
    if (queue.paused) {
      resumeMutation.mutate(queue.name);
    } else {
      pauseMutation.mutate(queue.name);
    }
  };

  const handleOpenDeleteDialog = (name: string) => {
    setQueueToDelete(name);
    setDeleteJobs(false);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (queueToDelete) {
      deleteMutation.mutate({ name: queueToDelete, deleteJobs });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queues"
        description="Manage job queues and their configurations"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <CreateQueueDialog
              onSuccess={(queueName) => {
                refetch();
                window.location.href = `/queues/${queueName}`;
              }}
            />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <DataTableLoading rows={5} columns={4} />
          ) : error ? (
            <InlineError
              title="Failed to load queues"
              error={error}
              onRetry={() => refetch()}
              isRetrying={isFetching}
            />
          ) : !queues || queues.length === 0 ? (
            <EmptyState
              title="No queues found"
              description="Create your first queue to start processing jobs"
              icon={Layers}
              action={
                <CreateQueueDialog
                  onSuccess={(queueName) => {
                    refetch();
                    window.location.href = `/queues/${queueName}`;
                  }}
                />
              }
            />
          ) : (
            <div className="divide-y">
              {queues.map((queue) => (
                <div key={queue.name} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <a
                          href={`/queues/${queue.name}`}
                          className="text-lg font-semibold hover:text-primary hover:underline"
                        >
                          {queue.name}
                        </a>
                        <QueueStatusBadge paused={queue.paused} size="sm" />
                      </div>

                      {queue.description && (
                        <p className="mb-3 text-sm text-muted-foreground">{queue.description}</p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Concurrency</p>
                          <p className="text-lg font-semibold">{queue.concurrency}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Max Retries</p>
                          <p className="text-lg font-semibold">{queue.max_retries}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Retry Delay</p>
                          <p className="text-lg font-semibold">{queue.retry_delay_ms}ms</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Job Timeout</p>
                          <p className="text-lg font-semibold">{queue.job_timeout_ms}ms</p>
                        </div>
                      </div>

                      {(queue.created_at || queue.updated_at) && (
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          {queue.created_at && (
                            <span>Created {formatRelativeTime(queue.created_at)}</span>
                          )}
                          {queue.updated_at && (
                            <span>Updated {formatRelativeTime(queue.updated_at)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Button
                        variant={queue.paused ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTogglePause(queue)}
                        disabled={pauseMutation.isPending || resumeMutation.isPending}
                      >
                        {queue.paused ? (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/queues/${queue.name}`}>
                          <Settings className="mr-2 h-4 w-4" />
                          Manage
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDeleteDialog(queue.name)}
                        disabled={deleteMutation.isPending}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DangerConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setQueueToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete Queue "${queueToDelete}"`}
        description={
          <>
            <p className="mb-3">
              Are you sure you want to delete this queue? This action cannot be undone.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deleteJobs}
                onChange={(e) => setDeleteJobs(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>Also delete all jobs in this queue</span>
            </label>
          </>
        }
        confirmText={queueToDelete || ''}
        confirmLabel="Delete Queue"
        isLoading={deleteMutation.isPending}
        warnings={
          deleteJobs
            ? [
                'Queue configuration will be deleted',
                'All jobs in this queue will be permanently deleted',
                'This includes pending, processing, and completed jobs',
              ]
            : [
                'Queue configuration will be deleted',
                'Existing jobs must be moved or completed first',
              ]
        }
      />
    </div>
  );
}

export function QueuesListPage() {
  return (
    <ProtectedPage>
      <QueuesListContent />
    </ProtectedPage>
  );
}
