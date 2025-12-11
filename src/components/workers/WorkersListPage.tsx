import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workersAPI } from '@/lib/api/workers';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { RefreshCw, Trash2, Server, Activity, Circle } from 'lucide-react';
import { toast } from 'sonner';
import type { Worker, WorkerStatus } from '@/lib/types';

const statusColors: Record<WorkerStatus, { badge: string; dot: string }> = {
  active: { badge: 'bg-green-500/10 text-green-700 border-green-500', dot: 'bg-green-500' },
  idle: { badge: 'bg-blue-500/10 text-blue-700 border-blue-500', dot: 'bg-blue-500' },
  offline: { badge: 'bg-gray-500/10 text-gray-700 border-gray-500', dot: 'bg-gray-500' },
  draining: { badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500', dot: 'bg-yellow-500' },
};

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const config = statusColors[status] || statusColors.offline;
  return (
    <Badge variant="outline" className={config.badge}>
      <Circle className={`mr-1.5 h-2 w-2 ${config.dot} fill-current`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function WorkersListContent() {
  const queryClient = useQueryClient();

  const {
    data: workers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workers.list(),
    queryFn: () => workersAPI.list(),
    refetchInterval: 5000,
  });

  const deregisterMutation = useMutation({
    mutationFn: (id: string) => workersAPI.deregister(id),
    onSuccess: () => {
      toast.success('Worker deregistered', {
        description: 'Worker has been removed from the pool',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.list() });
    },
    onError: (error) => {
      toast.error('Failed to deregister worker', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleDeregister = (worker: Worker) => {
    if (
      confirm(
        `Are you sure you want to deregister worker "${worker.hostname}"? This will stop the worker from processing jobs.`
      )
    ) {
      deregisterMutation.mutate(worker.id);
    }
  };

  const activeWorkers = workers?.filter((w) => w.status === 'active').length || 0;
  const idleWorkers = workers?.filter((w) => w.status === 'idle').length || 0;
  const offlineWorkers = workers?.filter((w) => w.status === 'offline').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workers</h1>
          <p className="text-muted-foreground">Monitor worker processes and their performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {!isLoading && workers && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Workers</p>
                  <p className="text-2xl font-bold">{workers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeWorkers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Circle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Idle</p>
                  <p className="text-2xl font-bold text-blue-600">{idleWorkers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-500/10 p-2">
                  <Circle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold text-gray-600">{offlineWorkers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load workers</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !workers || workers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Server className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No workers registered</p>
              <p className="text-sm">Workers will appear here once they connect to the system</p>
            </div>
          ) : (
            <div className="divide-y">
              {workers.map((worker) => (
                <div key={worker.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <a
                          href={`/workers/${worker.id}`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          {worker.hostname}
                        </a>
                        <WorkerStatusBadge status={worker.status} />
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-5">
                        <div>
                          <p className="text-xs text-muted-foreground">Queues</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {worker.queues.map((queue) => (
                              <Badge key={queue} variant="outline" className="text-xs">
                                {queue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Concurrency</p>
                          <p className="mt-1 text-sm font-medium">{worker.concurrency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Current Jobs</p>
                          <p className="mt-1 text-sm font-medium">
                            {worker.current_jobs} / {worker.concurrency}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Jobs Processed</p>
                          <p className="mt-1 text-sm font-medium text-green-600">
                            {worker.jobs_processed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Jobs Failed</p>
                          <p className="mt-1 text-sm font-medium text-red-600">
                            {worker.jobs_failed}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Started {formatRelativeTime(worker.started_at)}</span>
                        <span>Last heartbeat {formatRelativeTime(worker.last_heartbeat)}</span>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/workers/${worker.id}`}>View Details</a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeregister(worker)}
                        disabled={deregisterMutation.isPending}
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

export function WorkersListPage() {
  return (
    <ProtectedPage>
      <WorkersListContent />
    </ProtectedPage>
  );
}
