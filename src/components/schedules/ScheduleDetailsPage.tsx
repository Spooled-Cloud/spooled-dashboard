import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesAPI } from '@/lib/api/schedules';
import type { UpdateScheduleRequest } from '@/lib/api/schedules';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  Save,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import type { Schedule } from '@/lib/types';

interface ScheduleDetailsContentProps {
  scheduleId: string;
}

function ExecutionHistory({ scheduleId }: { scheduleId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: queryKeys.schedules.history(scheduleId),
    queryFn: () => schedulesAPI.getHistory(scheduleId),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Calendar className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No execution history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.slice(0, 10).map((execution) => (
        <div key={execution.id} className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            {execution.status === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <div>
              <a
                href={`/jobs/${execution.job_id}`}
                className="font-mono text-sm hover:text-primary"
              >
                {execution.job_id.slice(0, 12)}...
              </a>
              {execution.error && (
                <p className="mt-1 text-xs text-destructive">{execution.error}</p>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(execution.triggered_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScheduleDetailsContent({ scheduleId }: ScheduleDetailsContentProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<Partial<Schedule>>({});

  const {
    data: schedule,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.schedules.detail(scheduleId),
    queryFn: () => schedulesAPI.get(scheduleId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateScheduleRequest) => schedulesAPI.update(scheduleId, data),
    onSuccess: () => {
      toast.success('Schedule updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.detail(scheduleId) });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => schedulesAPI.resume(scheduleId),
    onSuccess: () => {
      toast.success('Schedule resumed', { description: 'Schedule is now active' });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.detail(scheduleId) });
    },
    onError: (error) => {
      toast.error('Failed to resume schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => schedulesAPI.pause(scheduleId),
    onSuccess: () => {
      toast.success('Schedule paused', { description: 'Schedule will not trigger until resumed' });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.detail(scheduleId) });
    },
    onError: (error) => {
      toast.error('Failed to pause schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => schedulesAPI.trigger(scheduleId),
    onSuccess: (data) => {
      toast.success('Schedule triggered!', {
        description: `Job ID: ${data.job_id}`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.history(scheduleId) });
    },
    onError: (error) => {
      toast.error('Failed to trigger schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => schedulesAPI.delete(scheduleId),
    onSuccess: () => {
      toast.success('Schedule deleted');
      window.location.href = '/schedules';
    },
    onError: (error) => {
      toast.error('Failed to delete schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleSave = () => {
    const updates: UpdateScheduleRequest = {};
    if (editedSchedule.name !== undefined) updates.name = editedSchedule.name;
    if (editedSchedule.description !== undefined) updates.description = editedSchedule.description;
    if (editedSchedule.cron_expression !== undefined)
      updates.cron_expression = editedSchedule.cron_expression;
    if (editedSchedule.timezone !== undefined) updates.timezone = editedSchedule.timezone;

    updateMutation.mutate(updates);
  };

  const handleTogglePaused = () => {
    if (schedule?.enabled) {
      pauseMutation.mutate();
    } else {
      resumeMutation.mutate();
    }
  };

  const handleTrigger = () => {
    if (confirm('Manually trigger this schedule? This will create a new job immediately.')) {
      triggerMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this schedule? This action cannot be undone.')) {
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

  if (error || !schedule) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">Failed to load schedule</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Schedule not found'}
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
            <h1 className="text-3xl font-bold tracking-tight">{schedule.name}</h1>
            <Badge variant={schedule.enabled ? 'default' : 'outline'}>
              {schedule.enabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
          {schedule.description && (
            <p className="mt-1 text-muted-foreground">{schedule.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrigger}
            disabled={triggerMutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            Run Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePaused}
            disabled={resumeMutation.isPending || pauseMutation.isPending}
          >
            {schedule.enabled ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuration</CardTitle>
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setEditedSchedule(schedule);
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
                      setEditedSchedule({});
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
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-3 w-3" />
                    Cron Expression
                  </label>
                  {isEditing ? (
                    <Input
                      value={editedSchedule.cron_expression || ''}
                      onChange={(e) =>
                        setEditedSchedule({ ...editedSchedule, cron_expression: e.target.value })
                      }
                      className="mt-1 font-mono"
                    />
                  ) : (
                    <p className="mt-1 font-mono text-sm">{schedule.cron_expression}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Timezone</label>
                  {isEditing ? (
                    <Input
                      value={editedSchedule.timezone || ''}
                      onChange={(e) =>
                        setEditedSchedule({ ...editedSchedule, timezone: e.target.value })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-sm">{schedule.timezone}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Queue</label>
                  <div className="mt-1">
                    <Badge variant="outline">{schedule.queue}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Job Type</label>
                  <p className="mt-1 text-sm">{schedule.job_type}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-sm font-medium">Payload</label>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                  <code>{JSON.stringify(schedule.payload, null, 2)}</code>
                </pre>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created {formatRelativeTime(schedule.created_at)}</span>
                  <span>Updated {formatRelativeTime(schedule.updated_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              <ExecutionHistory scheduleId={scheduleId} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={schedule.enabled ? 'default' : 'outline'}>
                  {schedule.enabled ? 'Active' : 'Paused'}
                </Badge>
              </div>
              {schedule.last_run && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Run</span>
                  <span className="text-sm">{formatRelativeTime(schedule.last_run)}</span>
                </div>
              )}
              {schedule.last_run_status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Status</span>
                  <Badge
                    variant={schedule.last_run_status === 'success' ? 'default' : 'destructive'}
                  >
                    {schedule.last_run_status}
                  </Badge>
                </div>
              )}
              {schedule.next_run && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Next Run</span>
                  <span className="text-sm">{formatRelativeTime(schedule.next_run)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Deleting a schedule is permanent and cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Schedule
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ScheduleDetailsPage({ scheduleId }: { scheduleId: string }) {
  return (
    <ProtectedPage>
      <ScheduleDetailsContent scheduleId={scheduleId} />
    </ProtectedPage>
  );
}
