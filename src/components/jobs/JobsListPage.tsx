import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { Search, RefreshCw, X } from 'lucide-react';
import { CreateJobDialog } from './CreateJobDialog';
import { BulkEnqueueDialog } from './BulkEnqueueDialog';
import type { JobStatus } from '@/lib/types';

const statusColors: Record<JobStatus, string> = {
  pending: 'border-yellow-500 text-yellow-600',
  scheduled: 'border-blue-500 text-blue-600',
  processing: 'bg-blue-500 text-white animate-pulse',
  completed: 'bg-success text-success-foreground',
  failed: 'bg-destructive text-destructive-foreground',
  cancelled: 'bg-secondary text-secondary-foreground',
  deadletter: 'bg-destructive/80 text-destructive-foreground',
};

interface JobFilters {
  status?: JobStatus;
  queue?: string;
  job_type?: string;
  search?: string;
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = statusColors[status] || '';

  return (
    <Badge variant={status === 'processing' ? 'default' : 'outline'} className={config}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function JobsListContent() {
  const [filters, setFilters] = useState<JobFilters>({});
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.jobs.list({ ...filters, page, per_page: 25 }),
    queryFn: () => jobsAPI.list({ ...filters, page, per_page: 25 }),
    refetchInterval: 10000,
  });

  const handleFilterChange = (key: keyof JobFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const hasFilters = Object.values(filters).some((v) => v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">Manage and monitor all jobs in the system</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <BulkEnqueueDialog onSuccess={() => refetch()} />
          <CreateJobDialog
            onSuccess={(jobId) => {
              refetch();
              window.location.href = `/jobs/${jobId}`;
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by job ID or type..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="deadletter">Dead Letter</option>
            </select>

            <Input
              placeholder="Queue..."
              value={filters.queue || ''}
              onChange={(e) => handleFilterChange('queue', e.target.value)}
              className="w-40"
            />

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load jobs</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !data?.data || data.data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-1 text-lg font-medium">No jobs found</p>
              <p className="text-sm">
                {hasFilters ? 'Try adjusting your filters' : 'Create your first job to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-4 text-left text-sm font-medium">Job ID</th>
                    <th className="p-4 text-left text-sm font-medium">Type</th>
                    <th className="p-4 text-left text-sm font-medium">Queue</th>
                    <th className="p-4 text-left text-sm font-medium">Status</th>
                    <th className="p-4 text-left text-sm font-medium">Priority</th>
                    <th className="p-4 text-left text-sm font-medium">Attempt</th>
                    <th className="p-4 text-left text-sm font-medium">Created</th>
                    <th className="p-4 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.data.map((job) => (
                    <tr key={job.id} className="transition-colors hover:bg-muted/30">
                      <td className="p-4">
                        <a
                          href={`/jobs/${job.id}`}
                          className="font-mono text-sm font-medium hover:text-primary"
                        >
                          {formatJobId(job.id, 12)}
                        </a>
                      </td>
                      <td className="p-4 text-sm">{job.job_type}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {job.queue}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="p-4 text-sm">{job.priority}</td>
                      <td className="p-4 text-sm">
                        {job.attempt}/{job.max_retries}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatRelativeTime(job.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/jobs/${job.id}`}>View</a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, data.total)} of {data.total}{' '}
                jobs
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function JobsListPage() {
  return (
    <ProtectedPage>
      <JobsListContent />
    </ProtectedPage>
  );
}
