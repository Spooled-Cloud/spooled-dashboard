import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI } from '@/lib/api/queues';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { RefreshCw, Pause, Play, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { CreateQueueDialog } from './CreateQueueDialog';
import type { Queue } from '@/lib/types';

function QueuesListContent() {
  const queryClient = useQueryClient();

  const {
    data: queues,
    isLoading,
    error,
    refetch,
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
    mutationFn: (name: string) => queuesAPI.delete(name),
    onSuccess: (_, name) => {
      toast.success('Queue deleted', { description: `Queue "${name}" has been removed` });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
    },
    onError: (error, name) => {
      toast.error('Failed to delete queue', {
        description: error instanceof Error ? error.message : `Could not delete "${name}"`,
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

  const handleDelete = (name: string) => {
    if (
      confirm(
        `Are you sure you want to delete the queue "${name}"? This can only be done if the queue is empty.`
      )
    ) {
      deleteMutation.mutate(name);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queues</h1>
          <p className="text-muted-foreground">Manage job queues and their configurations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreateQueueDialog
            onSuccess={(queueName) => {
              refetch();
              window.location.href = `/queues/${queueName}`;
            }}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load queues</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !queues || queues.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-1 text-lg font-medium">No queues found</p>
              <p className="text-sm">Create your first queue to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {queues.map((queue) => (
                <div key={queue.name} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <a
                          href={`/queues/${queue.name}`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          {queue.name}
                        </a>
                        {queue.paused && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            Paused
                          </Badge>
                        )}
                      </div>

                      {queue.description && (
                        <p className="mb-3 text-sm text-muted-foreground">{queue.description}</p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Concurrency</p>
                          <p className="text-sm font-medium">{queue.concurrency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Max Retries</p>
                          <p className="text-sm font-medium">{queue.max_retries}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Retry Delay</p>
                          <p className="text-sm font-medium">{queue.retry_delay_ms}ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Job Timeout</p>
                          <p className="text-sm font-medium">{queue.job_timeout_ms}ms</p>
                        </div>
                      </div>

                      {(queue.created_at || queue.updated_at) && (
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          {queue.created_at && <span>Created {formatRelativeTime(queue.created_at)}</span>}
                          {queue.updated_at && <span>Updated {formatRelativeTime(queue.updated_at)}</span>}
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Button
                        variant="outline"
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
                        size="sm"
                        onClick={() => handleDelete(queue.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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

export function QueuesListPage() {
  return (
    <ProtectedPage>
      <QueuesListContent />
    </ProtectedPage>
  );
}
