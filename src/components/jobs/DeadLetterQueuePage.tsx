import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { RefreshCw, Trash2, AlertTriangle, RotateCcw, CheckCircle, ArrowLeft } from 'lucide-react';
import type { Job } from '@/lib/types';
import { toast } from 'sonner';

function DeadLetterQueueContent() {
  const queryClient = useQueryClient();
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [queueFilter, setQueueFilter] = useState('');

  const {
    data: jobs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dlq', queueFilter],
    queryFn: () => jobsAPI.listDeadLetter({ queue_name: queueFilter || undefined, limit: 100 }),
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobIds: string[]) => jobsAPI.retryDeadLetter({ job_ids: jobIds }),
    onSuccess: (data) => {
      toast.success('Jobs retried successfully', {
        description: `${data.retried_count} job(s) moved back to queue`,
      });
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      setSelectedJobs(new Set());
    },
    onError: (error) => {
      toast.error('Failed to retry jobs', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const purgeMutation = useMutation({
    mutationFn: () =>
      jobsAPI.purgeDeadLetter({ queue_name: queueFilter || undefined, confirm: true }),
    onSuccess: (data) => {
      toast.success('Dead-letter queue purged', {
        description: `${data.purged_count} job(s) permanently deleted`,
      });
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      setSelectedJobs(new Set());
    },
    onError: (error) => {
      toast.error('Failed to purge queue', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleSelectAll = () => {
    if (jobs && selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else if (jobs) {
      setSelectedJobs(new Set(jobs.map((j) => j.id)));
    }
  };

  const handleToggleSelect = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleRetrySelected = () => {
    if (selectedJobs.size === 0) return;
    if (confirm(`Retry ${selectedJobs.size} job(s)?`)) {
      retryMutation.mutate(Array.from(selectedJobs));
    }
  };

  const handlePurgeAll = () => {
    const queueText = queueFilter ? ` in queue "${queueFilter}"` : '';
    if (
      confirm(
        `Permanently delete ALL jobs in the dead-letter queue${queueText}? This cannot be undone.`
      )
    ) {
      purgeMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/jobs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Dead-Letter Queue</h1>
          <p className="text-muted-foreground">Jobs that failed after all retry attempts</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Alert className="border-amber-500/50 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700">
          Jobs in the dead-letter queue have exceeded their maximum retry attempts. Review and
          decide whether to retry or permanently delete them.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>DLQ Jobs</CardTitle>
              <CardDescription>{jobs?.length || 0} jobs in dead-letter queue</CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Filter by queue..."
                value={queueFilter}
                onChange={(e) => setQueueFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load dead-letter queue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500 opacity-50" />
              <p className="mb-1 text-lg font-medium">Dead-letter queue is empty</p>
              <p className="text-sm">No failed jobs requiring attention</p>
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              <div className="flex items-center justify-between border-b bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedJobs.size === jobs.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedJobs.size > 0 ? `${selectedJobs.size} selected` : 'Select all'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetrySelected}
                    disabled={selectedJobs.size === 0 || retryMutation.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePurgeAll}
                    disabled={purgeMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Purge All
                  </Button>
                </div>
              </div>

              {/* Jobs List */}
              <div className="divide-y">
                {jobs.map((job: Job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={() => handleToggleSelect(job.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/jobs/${job.id}`}
                          className="font-mono text-sm font-medium hover:text-primary"
                        >
                          {formatJobId(job.id, 12)}
                        </a>
                        <Badge variant="outline" className="text-xs">
                          {job.queue}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{job.job_type}</p>
                      {job.error && (
                        <p className="mt-1 truncate text-xs text-destructive">
                          {job.error.message}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        Attempt {job.attempt}/{job.max_retries}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(job.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Retry this job?')) {
                          retryMutation.mutate([job.id]);
                        }
                      }}
                      disabled={retryMutation.isPending}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DeadLetterQueuePage() {
  return (
    <ProtectedPage>
      <DeadLetterQueueContent />
    </ProtectedPage>
  );
}
