import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation } from '@tanstack/react-query';
import { workersAPI } from '@/lib/api/workers';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Activity,
  Circle,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { WorkerStatus } from '@/lib/types';
import { toast } from 'sonner';

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

interface WorkerDetailsContentProps {
  workerId: string;
}

function WorkerDetailsContent({ workerId }: WorkerDetailsContentProps) {
  const {
    data: worker,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workers.detail(workerId),
    queryFn: () => workersAPI.get(workerId),
    refetchInterval: 3000,
  });

  const deregisterMutation = useMutation({
    mutationFn: () => workersAPI.deregister(workerId),
    onSuccess: () => {
      toast.success('Worker deregistered', { description: 'The worker has been removed' });
      window.location.href = '/workers';
    },
    onError: (error) => {
      toast.error('Failed to deregister worker', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleDeregister = () => {
    if (
      confirm(
        `Are you sure you want to deregister this worker? This will stop it from processing jobs.`
      )
    ) {
      deregisterMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 w-full lg:col-span-2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">Failed to load worker</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Worker not found'}
          </p>
          <Button variant="outline" onClick={() => window.history.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const successRate =
    worker.jobs_processed > 0
      ? (((worker.jobs_processed - worker.jobs_failed) / worker.jobs_processed) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{worker.hostname}</h1>
            <WorkerStatusBadge status={worker.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{worker.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeregister}
            disabled={deregisterMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Deregister
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Current Load</p>
            </div>
            <p className="text-2xl font-bold">
              {worker.current_jobs} / {worker.concurrency}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(worker.current_jobs / worker.concurrency) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Jobs Processed</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{worker.jobs_processed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Jobs Failed</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{worker.jobs_failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
            <p className="text-2xl font-bold">{successRate}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Worker Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Worker ID</p>
                  <p className="mt-1 font-mono text-sm">{worker.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hostname</p>
                  <p className="mt-1 text-sm font-medium">{worker.hostname}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <WorkerStatusBadge status={worker.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Concurrency</p>
                  <p className="mt-1 text-sm font-medium">{worker.concurrency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started At</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatRelativeTime(worker.started_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Heartbeat</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatRelativeTime(worker.last_heartbeat)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Queues</p>
                <div className="flex flex-wrap gap-2">
                  {worker.queues.map((queue) => (
                    <a key={queue} href={`/queues/${queue}`}>
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        {queue}
                      </Badge>
                    </a>
                  ))}
                </div>
              </div>

              {worker.metadata && Object.keys(worker.metadata).length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Metadata</p>
                  <div className="rounded-md bg-muted/50 p-3">
                    {Object.entries(worker.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1">
                        <span className="text-xs text-muted-foreground">{key}</span>
                        <span className="font-mono text-xs">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between">
                  <span className="text-sm text-muted-foreground">Utilization</span>
                  <span className="text-sm font-medium">
                    {((worker.current_jobs / worker.concurrency) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(worker.current_jobs / worker.concurrency) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex justify-between">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="text-sm font-medium">{successRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Processed</span>
                  <span className="font-medium">{worker.jobs_processed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Successful</span>
                  <span className="font-medium text-green-600">
                    {worker.jobs_processed - worker.jobs_failed}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="font-medium text-red-600">{worker.jobs_failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Deregistering a worker will prevent it from processing new jobs. Current jobs will
                complete.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeregister}
                disabled={deregisterMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deregister Worker
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function WorkerDetailsPage({ workerId }: { workerId: string }) {
  return (
    <ProtectedPage>
      <WorkerDetailsContent workerId={workerId} />
    </ProtectedPage>
  );
}
