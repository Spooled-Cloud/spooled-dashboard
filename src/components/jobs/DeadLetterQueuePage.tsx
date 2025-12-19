import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { JobStatusBadge } from '@/components/ui/status-badge';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableCell,
  DataTableLoading,
  CopyButton,
} from '@/components/ui/data-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { RefreshCw, Trash2, AlertTriangle, RotateCcw, CheckCircle } from 'lucide-react';
import type { Job } from '@/lib/types';
import { toast } from 'sonner';

function DeadLetterQueueContent() {
  const queryClient = useQueryClient();
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [queueFilter, setQueueFilter] = useState('');
  
  // Dialog states
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [singleRetryJobId, setSingleRetryJobId] = useState<string | null>(null);

  const {
    data: jobs,
    isLoading,
    error,
    refetch,
    isFetching,
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
      setShowRetryDialog(false);
      setSingleRetryJobId(null);
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
      setShowPurgeDialog(false);
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
    setShowRetryDialog(true);
  };

  const handleConfirmRetry = () => {
    if (singleRetryJobId) {
      retryMutation.mutate([singleRetryJobId]);
    } else {
      retryMutation.mutate(Array.from(selectedJobs));
    }
  };

  const handleSingleRetry = (jobId: string) => {
    setSingleRetryJobId(jobId);
    setShowRetryDialog(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dead-Letter Queue"
        description="Jobs that failed after all retry attempts"
        backHref="/jobs"
        backLabel="Back to Jobs"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <Alert className="border-amber-500/50 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
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
            <DataTableLoading rows={5} columns={5} />
          ) : error ? (
            <InlineError
              title="Failed to load dead-letter queue"
              error={error}
              onRetry={() => refetch()}
              isRetrying={isFetching}
            />
          ) : !jobs || jobs.length === 0 ? (
            <EmptyState
              title="Dead-letter queue is empty"
              description="No failed jobs requiring attention"
              icon={CheckCircle}
              compact
            />
          ) : (
            <>
              {/* Bulk Actions */}
              <div className="flex items-center justify-between border-b bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedJobs.size === jobs.length && jobs.length > 0}
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
                    Retry Selected ({selectedJobs.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowPurgeDialog(true)}
                    disabled={purgeMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Purge All
                  </Button>
                </div>
              </div>

              {/* Jobs Table */}
              <DataTable>
                <DataTableHeader>
                  <tr>
                    <DataTableHead className="w-10"></DataTableHead>
                    <DataTableHead>Job ID</DataTableHead>
                    <DataTableHead>Queue / Type</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                    <DataTableHead>Attempts</DataTableHead>
                    <DataTableHead>Error</DataTableHead>
                    <DataTableHead align="right">Actions</DataTableHead>
                  </tr>
                </DataTableHeader>
                <tbody className="divide-y">
                  {jobs.map((job: Job) => (
                    <DataTableRow key={job.id}>
                      <DataTableCell>
                        <input
                          type="checkbox"
                          checked={selectedJobs.has(job.id)}
                          onChange={() => handleToggleSelect(job.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </DataTableCell>
                      <DataTableCell mono>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/jobs/${job.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {formatJobId(job.id, 12)}
                          </a>
                          <CopyButton value={job.id} />
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit text-xs">
                            {job.queue}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{job.job_type}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <JobStatusBadge status={job.status} size="sm" />
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{job.attempt}/{job.max_retries}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(job.created_at)}
                          </span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        {job.error && (
                          <p className="max-w-xs truncate text-xs text-destructive" title={job.error.message}>
                            {job.error.message}
                          </p>
                        )}
                      </DataTableCell>
                      <DataTableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSingleRetry(job.id)}
                            disabled={retryMutation.isPending}
                            title="Retry job"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/jobs/${job.id}`}>View</a>
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </tbody>
              </DataTable>
            </>
          )}
        </CardContent>
      </Card>

      {/* Retry Confirmation Dialog */}
      <DangerConfirmDialog
        open={showRetryDialog}
        onOpenChange={(open) => {
          setShowRetryDialog(open);
          if (!open) setSingleRetryJobId(null);
        }}
        onConfirm={handleConfirmRetry}
        title="Retry Failed Jobs"
        description={
          singleRetryJobId
            ? 'This will move the job back to the pending queue for another retry attempt.'
            : `This will move ${selectedJobs.size} job(s) back to their respective queues for another retry attempt.`
        }
        confirmLabel="Retry"
        isLoading={retryMutation.isPending}
      />

      {/* Purge Confirmation Dialog */}
      <DangerConfirmDialog
        open={showPurgeDialog}
        onOpenChange={setShowPurgeDialog}
        onConfirm={() => purgeMutation.mutate()}
        title="Purge Dead-Letter Queue"
        description={
          queueFilter
            ? `Permanently delete ALL jobs in the dead-letter queue for "${queueFilter}"?`
            : 'Permanently delete ALL jobs in the dead-letter queue?'
        }
        confirmText="PURGE"
        confirmLabel="Purge All"
        isLoading={purgeMutation.isPending}
        warnings={[
          'This action cannot be undone',
          `${jobs?.length || 0} job(s) will be permanently deleted`,
          'Job data and history will be lost forever',
        ]}
      />
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
