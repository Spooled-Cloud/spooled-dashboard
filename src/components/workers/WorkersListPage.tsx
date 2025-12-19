import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { DataTableLoading } from '@/components/ui/data-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workersAPI } from '@/lib/api/workers';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { RefreshCw, Trash2, Server, Activity, Circle, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import type { Worker, WorkerStatus } from '@/lib/types';

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const statusMap: Record<WorkerStatus, 'active' | 'inactive' | 'paused' | 'unhealthy'> = {
    active: 'active',
    idle: 'inactive',
    offline: 'unhealthy',
    draining: 'paused',
  };
  return <StatusBadge status={statusMap[status] || 'inactive'} label={status} size="sm" />;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg ${color} p-2`}>
            {icon}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkersListContent() {
  const queryClient = useQueryClient();
  const [deregisterDialogOpen, setDeregisterDialogOpen] = useState(false);
  const [workerToDeregister, setWorkerToDeregister] = useState<Worker | null>(null);

  const {
    data: workers,
    isLoading,
    error,
    refetch,
    isFetching,
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
      setDeregisterDialogOpen(false);
      setWorkerToDeregister(null);
    },
    onError: (error) => {
      toast.error('Failed to deregister worker', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleOpenDeregisterDialog = (worker: Worker) => {
    setWorkerToDeregister(worker);
    setDeregisterDialogOpen(true);
  };

  const handleConfirmDeregister = () => {
    if (workerToDeregister) {
      deregisterMutation.mutate(workerToDeregister.id);
    }
  };

  const activeWorkers = workers?.filter((w) => w.status === 'active').length || 0;
  const idleWorkers = workers?.filter((w) => w.status === 'idle').length || 0;
  const offlineWorkers = workers?.filter((w) => w.status === 'offline').length || 0;
  const totalConcurrency = workers?.reduce((acc, w) => acc + w.concurrency, 0) || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Monitor worker processes and their performance"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Stats Grid */}
      {!isLoading && workers && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            title="Total Workers"
            value={workers.length}
            icon={<Server className="h-5 w-5 text-primary" />}
            color="bg-primary/10"
          />
          <StatCard
            title="Active"
            value={activeWorkers}
            icon={<Activity className="h-5 w-5 text-emerald-600" />}
            color="bg-emerald-500/10"
          />
          <StatCard
            title="Idle"
            value={idleWorkers}
            icon={<Circle className="h-5 w-5 text-blue-600" />}
            color="bg-blue-500/10"
          />
          <StatCard
            title="Offline"
            value={offlineWorkers}
            icon={<Circle className="h-5 w-5 text-gray-600" />}
            color="bg-gray-500/10"
          />
          <StatCard
            title="Total Capacity"
            value={totalConcurrency}
            icon={<Cpu className="h-5 w-5 text-violet-600" />}
            color="bg-violet-500/10"
          />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <DataTableLoading rows={5} columns={6} />
          ) : error ? (
            <InlineError
              title="Failed to load workers"
              error={error}
              onRetry={() => refetch()}
              isRetrying={isFetching}
            />
          ) : !workers || workers.length === 0 ? (
            <EmptyState
              title="No workers registered"
              description="Workers will appear here once they connect to the system"
              icon={Server}
            />
          ) : (
            <div className="divide-y">
              {workers.map((worker) => (
                <div key={worker.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <a
                          href={`/workers/${worker.id}`}
                          className="text-lg font-semibold hover:text-primary hover:underline"
                        >
                          {worker.hostname}
                        </a>
                        <WorkerStatusBadge status={worker.status} />
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-5">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Queues</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {worker.queues.slice(0, 3).map((queue) => (
                              <Badge key={queue} variant="outline" className="text-xs">
                                {queue}
                              </Badge>
                            ))}
                            {worker.queues.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{worker.queues.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs font-medium text-muted-foreground">Concurrency</p>
                          <p className="text-lg font-semibold">{worker.concurrency}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <p className="text-xs font-medium text-muted-foreground">Current Jobs</p>
                          <p className="text-lg font-semibold">
                            {worker.current_jobs} 
                            <span className="text-sm font-normal text-muted-foreground">
                              / {worker.concurrency}
                            </span>
                          </p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/5 p-2">
                          <p className="text-xs font-medium text-muted-foreground">Processed</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            {worker.jobs_processed.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-lg bg-red-500/5 p-2">
                          <p className="text-xs font-medium text-muted-foreground">Failed</p>
                          <p className="text-lg font-semibold text-red-600">
                            {worker.jobs_failed.toLocaleString()}
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
                        size="icon"
                        onClick={() => handleOpenDeregisterDialog(worker)}
                        disabled={deregisterMutation.isPending}
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

      {/* Deregister Confirmation Dialog */}
      <DangerConfirmDialog
        open={deregisterDialogOpen}
        onOpenChange={(open) => {
          setDeregisterDialogOpen(open);
          if (!open) setWorkerToDeregister(null);
        }}
        onConfirm={handleConfirmDeregister}
        title="Deregister Worker"
        description={
          workerToDeregister ? (
            <>
              Are you sure you want to deregister <strong>{workerToDeregister.hostname}</strong>?
            </>
          ) : (
            'Are you sure you want to deregister this worker?'
          )
        }
        confirmLabel="Deregister"
        isLoading={deregisterMutation.isPending}
        warnings={
          workerToDeregister?.current_jobs && workerToDeregister.current_jobs > 0
            ? [
                `Worker has ${workerToDeregister.current_jobs} job(s) currently processing`,
                'Jobs may be interrupted and returned to the queue',
              ]
            : ['Worker will stop receiving new jobs', 'Worker can re-register by reconnecting']
        }
      />
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
