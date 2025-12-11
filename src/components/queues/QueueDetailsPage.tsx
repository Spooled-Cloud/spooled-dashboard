import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queuesAPI } from '@/lib/api/queues';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  ArrowLeft,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Save,
  AlertCircle,
  TrendingUp,
  Clock,
  Activity,
} from 'lucide-react';
import type { Queue } from '@/lib/types';
import type { UpdateQueueRequest } from '@/lib/api/queues';
import { toast } from 'sonner';

interface QueueDetailsContentProps {
  queueName: string;
}

function QueueStatsCard({ queueName }: { queueName: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.queues.stats(queueName),
    queryFn: () => queuesAPI.getStats(queueName),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Processing</p>
          <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active Workers</p>
          </div>
          <p className="text-2xl font-bold">{stats.active_workers}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Jobs/Second</p>
          </div>
          <p className="text-2xl font-bold">{stats.jobs_per_second.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Avg Process Time</p>
          </div>
          <p className="text-2xl font-bold">{stats.avg_processing_time_ms.toFixed(0)}ms</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Dead Letter</p>
          <p className="text-2xl font-bold text-destructive">{stats.deadletter}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueDetailsContent({ queueName }: QueueDetailsContentProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedQueue, setEditedQueue] = useState<Partial<Queue>>({});

  const {
    data: queue,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.queues.detail(queueName),
    queryFn: () => queuesAPI.get(queueName),
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

  const purgeMutation = useMutation({
    mutationFn: () => queuesAPI.purge(queueName),
    onSuccess: (data) => {
      toast.success('Queue purged', { description: `${data.deleted} job(s) deleted` });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.stats(queueName) });
    },
    onError: (error) => {
      toast.error('Failed to purge queue', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => queuesAPI.delete(queueName),
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
    if (editedQueue.retry_delay_ms !== undefined)
      updates.retry_delay_ms = editedQueue.retry_delay_ms;
    if (editedQueue.backoff_multiplier !== undefined)
      updates.backoff_multiplier = editedQueue.backoff_multiplier;
    if (editedQueue.max_retry_delay_ms !== undefined)
      updates.max_retry_delay_ms = editedQueue.max_retry_delay_ms;
    if (editedQueue.job_timeout_ms !== undefined)
      updates.job_timeout_ms = editedQueue.job_timeout_ms;

    updateMutation.mutate(updates);
  };

  const handleTogglePause = () => {
    if (queue?.paused) {
      resumeMutation.mutate();
    } else {
      pauseMutation.mutate();
    }
  };

  const handlePurge = () => {
    if (
      confirm(
        `Are you sure you want to delete ALL jobs in the "${queueName}" queue? This action cannot be undone.`
      )
    ) {
      purgeMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete the "${queueName}" queue? This can only be done if the queue is empty.`
      )
    ) {
      deleteMutation.mutate();
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

  if (error || !queue) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">Failed to load queue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Queue not found'}
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{queue.name}</h1>
            {queue.paused && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                Paused
              </Badge>
            )}
          </div>
          {queue.description && <p className="mt-1 text-muted-foreground">{queue.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
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
          )}
        </div>
      </div>

      <QueueStatsCard queueName={queueName} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuration</CardTitle>
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
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Concurrency</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedQueue.concurrency || ''}
                      onChange={(e) =>
                        setEditedQueue({ ...editedQueue, concurrency: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.concurrency}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Max Retries</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedQueue.max_retries || ''}
                      onChange={(e) =>
                        setEditedQueue({ ...editedQueue, max_retries: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.max_retries}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Retry Delay (ms)</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedQueue.retry_delay_ms || ''}
                      onChange={(e) =>
                        setEditedQueue({ ...editedQueue, retry_delay_ms: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.retry_delay_ms}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Backoff Multiplier</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.1"
                      value={editedQueue.backoff_multiplier || ''}
                      onChange={(e) =>
                        setEditedQueue({
                          ...editedQueue,
                          backoff_multiplier: parseFloat(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.backoff_multiplier}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Max Retry Delay (ms)</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedQueue.max_retry_delay_ms || ''}
                      onChange={(e) =>
                        setEditedQueue({
                          ...editedQueue,
                          max_retry_delay_ms: parseInt(e.target.value),
                        })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.max_retry_delay_ms}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Job Timeout (ms)</label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editedQueue.job_timeout_ms || ''}
                      onChange={(e) =>
                        setEditedQueue({ ...editedQueue, job_timeout_ms: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{queue.job_timeout_ms}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={editedQueue.description || ''}
                    onChange={(e) =>
                      setEditedQueue({ ...editedQueue, description: e.target.value })
                    }
                    placeholder="Optional description"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {formatRelativeTime(queue.created_at)}</span>
                  <span>Updated {formatRelativeTime(queue.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href={`/jobs?queue=${queueName}`}>View Jobs in Queue</a>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handlePurge}
                disabled={purgeMutation.isPending}
              >
                Purge All Jobs
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-3 text-sm text-muted-foreground">
                  Deleting a queue is permanent and cannot be undone. The queue must be empty before
                  deletion.
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Queue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
