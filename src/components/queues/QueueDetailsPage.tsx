import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { QueueStatusBadge } from '@/components/ui/status-badge';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { InlineError } from '@/components/ui/inline-error';
import { SSEIndicator } from '@/components/ui/sse-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI, type UpdateQueueRequest } from '@/lib/api/queues';
import { workersAPI } from '@/lib/api/workers';
import { useQueueSSE } from '@/lib/hooks/use-sse';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Save,
  TrendingUp,
  Clock,
  Activity,
  Loader2,
  Users,
  Gauge,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type { Queue, Worker, QueueStats } from '@/lib/types';
import { toast } from 'sonner';

interface QueueDetailsContentProps {
  queueName: string;
}

interface HealthStripProps {
  stats: QueueStats | undefined;
  isLoading: boolean;
}

function HealthStrip({ stats, isLoading }: HealthStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const metrics = [
    {
      label: 'Pending',
      value: stats.pending,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      icon: Clock,
    },
    {
      label: 'Processing',
      value: stats.processing,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      icon: Loader2,
      animate: stats.processing > 0,
    },
    {
      label: 'Completed (24h)',
      value: stats.completed,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      icon: TrendingUp,
    },
    {
      label: 'Failed (24h)',
      value: stats.failed,
      color: stats.failed > 0 ? 'text-red-600' : 'text-muted-foreground',
      bgColor: stats.failed > 0 ? 'bg-red-500/10' : 'bg-muted/50',
      icon: AlertTriangle,
    },
    {
      label: 'Active Workers',
      value: stats.active_workers,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
      icon: Users,
    },
    {
      label: 'Throughput',
      value: `${stats.jobs_per_second.toFixed(1)}/s`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      icon: Zap,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {metrics.map((metric, idx) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <Card className={metric.bgColor}>
        <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <metric.icon 
                  className={`h-4 w-4 ${metric.color} ${metric.animate ? 'animate-spin' : ''}`} 
                />
              </div>
              <p className={`mt-2 text-2xl font-bold ${metric.color}`}>
                {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
              </p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
        </CardContent>
      </Card>
        </motion.div>
      ))}
    </div>
  );
}

interface CapacityViewProps {
  queueName: string;
  stats: QueueStats | undefined;
}

function CapacityView({ queueName, stats }: CapacityViewProps) {
  const { data: workers, isLoading } = useQuery({
    queryKey: queryKeys.workers.list(),
    queryFn: () => workersAPI.list(),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  // Filter workers that handle this queue
  const queueWorkers = workers?.filter((w: Worker) => 
    w.queues.includes(queueName) || w.queues.includes('*')
  ) || [];

  const totalCapacity = queueWorkers.reduce((acc: number, w: Worker) => acc + w.concurrency, 0);
  const activeWorkers = queueWorkers.filter((w: Worker) => w.status === 'active').length;
  const currentlyProcessing = stats?.processing || 0;
  const pending = stats?.pending || 0;

  const utilizationPercent = totalCapacity > 0 
    ? Math.min(100, (currentlyProcessing / totalCapacity) * 100) 
    : 0;

  const backlogMinutes = stats?.avg_processing_time_ms && stats.avg_processing_time_ms > 0 && totalCapacity > 0
    ? (pending * (stats.avg_processing_time_ms / 1000 / 60)) / totalCapacity
    : 0;

  return (
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Capacity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Worker Utilization</span>
            <span className="font-medium">{utilizationPercent.toFixed(0)}%</span>
          </div>
          <Progress value={utilizationPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {currentlyProcessing} of {totalCapacity} slots in use
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Workers</p>
            <p className="text-lg font-semibold">
              {activeWorkers} <span className="text-sm font-normal text-muted-foreground">/ {queueWorkers.length}</span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Total Capacity</p>
            <p className="text-lg font-semibold">{totalCapacity}</p>
          </div>
        </div>

        {pending > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Backlog Estimate</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-amber-600">
              ~{backlogMinutes.toFixed(1)} min
            </p>
            <p className="text-xs text-muted-foreground">
              {pending.toLocaleString()} pending jobs
            </p>
          </div>
        )}

        {queueWorkers.length === 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-600" />
            <p className="mt-1 text-sm font-medium text-amber-600">No Workers</p>
            <p className="text-xs text-muted-foreground">
              No workers are configured to process this queue
            </p>
          </div>
        )}
        </CardContent>
      </Card>
  );
}

function QueueDetailsContent({ queueName }: QueueDetailsContentProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedQueue, setEditedQueue] = useState<Partial<Queue>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteJobs, setDeleteJobs] = useState(false);

  const {
    data: queue,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.queues.detail(queueName),
    queryFn: () => queuesAPI.get(queueName),
  });

  // SSE for real-time queue stats updates
  const { isConnected: sseConnected, isConnecting: sseConnecting, error: sseError, reconnect: sseReconnect } = useQueueSSE(
    queueName,
    {
      enabled: true,
      onEvent: (event) => {
        // Refetch stats when we receive an update
        if (event.type === 'queue_stats_updated') {
          queryClient.invalidateQueries({ queryKey: queryKeys.queues.stats(queueName) });
        }
      },
    }
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.queues.stats(queueName),
    queryFn: () => queuesAPI.getStats(queueName),
    // With SSE connected, poll less frequently as backup
    refetchInterval: sseConnected ? 30000 : 5000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateQueueRequest) => queuesAPI.update(queueName, data),
    onSuccess: () => {
      toast.success('Queue updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.detail(queueName) });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update queue', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => queuesAPI.pause(queueName),
    onSuccess: () => {
      toast.success('Queue paused', { description: 'Job processing has been stopped' });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.detail(queueName) });
    },
    onError: (error) => {
      toast.error('Failed to pause queue', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => queuesAPI.resume(queueName),
    onSuccess: () => {
      toast.success('Queue resumed', { description: 'Job processing has been restarted' });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.detail(queueName) });
    },
    onError: (error) => {
      toast.error('Failed to resume queue', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => queuesAPI.delete(queueName, deleteJobs),
    onSuccess: () => {
      toast.success('Queue deleted');
      window.location.href = '/queues';
    },
    onError: (error) => {
      toast.error('Failed to delete queue', {
        description: error instanceof Error ? error.message : 'Queue may not be empty',
      });
    },
  });

  const handleSave = () => {
    const updates: UpdateQueueRequest = {};
    if (editedQueue.description !== undefined) updates.description = editedQueue.description;
    if (editedQueue.concurrency !== undefined) updates.concurrency = editedQueue.concurrency;
    if (editedQueue.max_retries !== undefined) updates.max_retries = editedQueue.max_retries;
    if (editedQueue.retry_delay_ms !== undefined) updates.retry_delay_ms = editedQueue.retry_delay_ms;
    if (editedQueue.backoff_multiplier !== undefined) updates.backoff_multiplier = editedQueue.backoff_multiplier;
    if (editedQueue.max_retry_delay_ms !== undefined) updates.max_retry_delay_ms = editedQueue.max_retry_delay_ms;
    if (editedQueue.job_timeout_ms !== undefined) updates.job_timeout_ms = editedQueue.job_timeout_ms;

    updateMutation.mutate(updates);
  };

  const handleTogglePause = () => {
    if (queue?.paused) {
      resumeMutation.mutate();
    } else {
      pauseMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !queue) {
    return (
      <InlineError
        title="Failed to load queue"
        error={error || 'Queue not found'}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={queue.name}
        description={queue.description}
        backHref="/queues"
        backLabel="Back to Queues"
        actions={
          <>
            <SSEIndicator
              isConnected={sseConnected}
              isConnecting={sseConnecting}
              error={sseError}
              onReconnect={sseReconnect}
            />
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          {!isEditing && (
            <Button
                variant={queue.paused ? 'default' : 'outline'}
              size="sm"
              onClick={handleTogglePause}
              disabled={pauseMutation.isPending || resumeMutation.isPending}
            >
                {pauseMutation.isPending || resumeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : queue.paused ? (
                  <Play className="mr-2 h-4 w-4" />
              ) : (
                  <Pause className="mr-2 h-4 w-4" />
              )}
                {queue.paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          </>
        }
      >
        <QueueStatusBadge paused={queue.paused} size="sm" />
      </PageHeader>

      {/* Health Strip */}
      <HealthStrip stats={stats} isLoading={statsLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Configuration */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
              <CardTitle>Configuration</CardTitle>
                <CardDescription>Queue processing settings</CardDescription>
              </div>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setEditedQueue(queue);
                  }}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedQueue({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {[
                  { key: 'concurrency', label: 'Concurrency', type: 'number' },
                  { key: 'max_retries', label: 'Max Retries', type: 'number' },
                  { key: 'retry_delay_ms', label: 'Retry Delay (ms)', type: 'number' },
                  { key: 'backoff_multiplier', label: 'Backoff Multiplier', type: 'number', step: '0.1' },
                  { key: 'max_retry_delay_ms', label: 'Max Retry Delay (ms)', type: 'number' },
                  { key: 'job_timeout_ms', label: 'Job Timeout (ms)', type: 'number' },
                ].map((field) => (
                  <div key={field.key} className="rounded-lg bg-muted/50 p-3">
                    <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  {isEditing ? (
                    <Input
                        type={field.type}
                        step={field.step}
                        value={(editedQueue as Record<string, number | string>)[field.key] || ''}
                      onChange={(e) =>
                        setEditedQueue({
                          ...editedQueue,
                            [field.key]: field.step 
                              ? parseFloat(e.target.value) 
                              : parseInt(e.target.value),
                        })
                      }
                        className="mt-1 h-8"
                    />
                  ) : (
                      <p className="mt-1 text-lg font-semibold">
                        {(queue as unknown as Record<string, number | string | boolean>)[field.key]?.toLocaleString()}
                      </p>
                  )}
                </div>
                ))}
              </div>

              {isEditing && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={editedQueue.description || ''}
                    onChange={(e) => setEditedQueue({ ...editedQueue, description: e.target.value })}
                    placeholder="Optional description"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                  <span>Created {formatRelativeTime(queue.created_at)}</span>
                  <span>Updated {formatRelativeTime(queue.updated_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={`/jobs?queue=${queueName}`}>
                  <Activity className="mr-2 h-4 w-4" />
                  View Jobs
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/jobs/dlq">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Dead Letter Queue
                </a>
                      </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Capacity View */}
          <CapacityView queueName={queueName} stats={stats} />

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Deleting a queue is permanent and cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Queue
                </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <DangerConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => deleteMutation.mutate()}
        title={`Delete Queue "${queueName}"`}
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
        confirmText={queueName}
        confirmLabel="Delete Queue"
        isLoading={deleteMutation.isPending}
        warnings={
          deleteJobs
            ? [
                'Queue configuration will be deleted',
                'All jobs in this queue will be permanently deleted',
                'This includes pending, processing, and completed jobs',
              ]
            : ['Queue configuration will be deleted', 'Queue must be empty to delete without deleting jobs']
        }
      />
    </div>
  );
}

export function QueueDetailsPage({ queueName }: { queueName: string }) {
  return (
    <ProtectedPage>
      <QueueDetailsContent queueName={queueName} />
    </ProtectedPage>
  );
}
