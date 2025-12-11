import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesAPI } from '@/lib/api/schedules';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  RefreshCw,
  Play,
  Pause,
  Trash2,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateScheduleDialog } from './CreateScheduleDialog';
import type { Schedule } from '@/lib/types';

function ScheduleStatusBadge({
  enabled,
  lastStatus,
}: {
  enabled: boolean;
  lastStatus?: 'success' | 'failed';
}) {
  if (!enabled) {
    return (
      <Badge variant="outline" className="border-gray-500 text-gray-600">
        <Pause className="mr-1 h-3 w-3" />
        Paused
      </Badge>
    );
  }
  if (lastStatus === 'failed') {
    return (
      <Badge variant="outline" className="border-red-500 text-red-600">
        <XCircle className="mr-1 h-3 w-3" />
        Last Run Failed
      </Badge>
    );
  }
  if (lastStatus === 'success') {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <CheckCircle className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-blue-500 text-blue-600">
      Active
    </Badge>
  );
}

function SchedulesListContent() {
  const queryClient = useQueryClient();

  const {
    data: schedules,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.schedules.list(),
    queryFn: () => schedulesAPI.list(),
    refetchInterval: 30000,
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => schedulesAPI.resume(id),
    onSuccess: () => {
      toast.success('Schedule resumed', { description: 'Schedule is now active' });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
    onError: (error) => {
      toast.error('Failed to resume schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => schedulesAPI.pause(id),
    onSuccess: () => {
      toast.success('Schedule paused', { description: 'Schedule will not trigger until resumed' });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
    onError: (error) => {
      toast.error('Failed to pause schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => schedulesAPI.trigger(id),
    onSuccess: (data) => {
      toast.success('Schedule triggered!', {
        description: `Job ID: ${data.job_id}`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
    onError: (error) => {
      toast.error('Failed to trigger schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesAPI.delete(id),
    onSuccess: () => {
      toast.success('Schedule deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
    },
    onError: (error) => {
      toast.error('Failed to delete schedule', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleTogglePaused = (schedule: Schedule) => {
    if (schedule.enabled) {
      pauseMutation.mutate(schedule.id);
    } else {
      resumeMutation.mutate(schedule.id);
    }
  };

  const handleTrigger = (schedule: Schedule) => {
    if (
      confirm(
        `Manually trigger schedule "${schedule.name}"? This will create a new job immediately.`
      )
    ) {
      triggerMutation.mutate(schedule.id);
    }
  };

  const handleDelete = (schedule: Schedule) => {
    if (confirm(`Delete schedule "${schedule.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(schedule.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground">Manage cron-based job schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreateScheduleDialog
            onSuccess={() => {
              refetch();
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
              <p className="text-destructive">Failed to load schedules</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !schedules || schedules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No schedules found</p>
              <p className="text-sm">Create your first schedule to automate job creation</p>
            </div>
          ) : (
            <div className="divide-y">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <a
                          href={`/schedules/${schedule.id}`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          {schedule.name}
                        </a>
                        <ScheduleStatusBadge
                          enabled={schedule.enabled}
                          lastStatus={schedule.last_run_status}
                        />
                      </div>

                      {schedule.description && (
                        <p className="mb-3 text-sm text-muted-foreground">{schedule.description}</p>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Cron
                          </p>
                          <p className="mt-1 font-mono text-sm">{schedule.cron_expression}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Queue</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {schedule.queue}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Job Type</p>
                          <p className="mt-1 text-sm font-medium">{schedule.job_type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Timezone</p>
                          <p className="mt-1 text-sm font-medium">{schedule.timezone}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        {schedule.last_run && (
                          <span>Last run {formatRelativeTime(schedule.last_run)}</span>
                        )}
                        {schedule.next_run && (
                          <span>Next run {formatRelativeTime(schedule.next_run)}</span>
                        )}
                        <span>Created {formatRelativeTime(schedule.created_at)}</span>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTrigger(schedule)}
                        disabled={triggerMutation.isPending}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePaused(schedule)}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(schedule)}
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

export function SchedulesListPage() {
  return (
    <ProtectedPage>
      <SchedulesListContent />
    </ProtectedPage>
  );
}
