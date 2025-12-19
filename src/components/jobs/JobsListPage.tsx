import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { JobStatusBadge } from '@/components/ui/status-badge';
import {
  DataTableContainer,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableCell,
  DataTableLoading,
  DataTableEmpty,
  DataTableError,
  DataTablePagination,
  CopyButton,
} from '@/components/ui/data-table';
import { useQuery } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { Search, RefreshCw, X } from 'lucide-react';
import { CreateJobDialog } from './CreateJobDialog';
import { BulkEnqueueDialog } from './BulkEnqueueDialog';
import { QuickStatusLookup } from './QuickStatusLookup';
import type { JobStatus } from '@/lib/types';

interface JobFilters {
  status?: JobStatus;
  queue?: string;
  job_type?: string;
  search?: string;
}

function JobsListContent() {
  const [filters, setFilters] = useState<JobFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.jobs.list({ ...filters, page, per_page: pageSize }),
    queryFn: () => jobsAPI.list({ ...filters, page, per_page: pageSize }),
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
      <PageHeader
        title="Jobs"
        description="Manage and monitor all jobs in the system"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <QuickStatusLookup />
            <BulkEnqueueDialog onSuccess={() => refetch()} />
            <CreateJobDialog
              onSuccess={(jobId) => {
                refetch();
                window.location.href = `/jobs/${jobId}`;
              }}
            />
          </>
        }
      />

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
      <DataTableContainer>
        {isLoading ? (
          <DataTableLoading rows={5} columns={7} />
        ) : error ? (
          <DataTableError 
            error={error} 
            onRetry={() => refetch()} 
            isRetrying={isFetching} 
          />
        ) : !data?.data || data.data.length === 0 ? (
          <DataTableEmpty
            title="No jobs found"
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            action={
              <CreateJobDialog
                onSuccess={(jobId) => {
                  refetch();
                  window.location.href = `/jobs/${jobId}`;
                }}
              />
            }
          />
        ) : (
          <>
            <DataTable>
              <DataTableHeader>
                <tr>
                  <DataTableHead>Job ID</DataTableHead>
                  <DataTableHead>Type</DataTableHead>
                  <DataTableHead>Queue</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead align="center">Priority</DataTableHead>
                  <DataTableHead align="center">Attempt</DataTableHead>
                  <DataTableHead>Created</DataTableHead>
                  <DataTableHead align="right">Actions</DataTableHead>
                </tr>
              </DataTableHeader>
              <tbody className="divide-y">
                {data.data.map((job) => (
                  <DataTableRow key={job.id} clickable>
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
                      <span className="font-medium">{job.job_type}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="outline" className="text-xs">
                        {job.queue}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>
                      <JobStatusBadge status={job.status} size="sm" />
                    </DataTableCell>
                    <DataTableCell align="center" muted>
                      {job.priority}
                    </DataTableCell>
                    <DataTableCell align="center" muted>
                      {job.attempt}/{job.max_retries}
                    </DataTableCell>
                    <DataTableCell muted>
                      {formatRelativeTime(job.created_at)}
                    </DataTableCell>
                    <DataTableCell align="right">
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/jobs/${job.id}`}>View</a>
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>

            {/* Pagination */}
            {data.total > 0 && (
              <DataTablePagination
                currentPage={page}
                totalPages={data.total_pages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </DataTableContainer>
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
