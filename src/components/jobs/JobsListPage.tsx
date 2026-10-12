import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  jobsAPI,
  withExactTotal,
  JOBS_FILTER_UNSUPPORTED_MESSAGE,
  JOBS_LIST_MAX_PAGE,
} from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime, formatJobId } from '@/lib/utils/format';
import { Info, Search, RefreshCw, X } from 'lucide-react';
import { CreateJobDialog } from './CreateJobDialog';
import { BulkEnqueueDialog } from './BulkEnqueueDialog';
import { QuickStatusLookup } from './QuickStatusLookup';
import { useDebouncedValue } from './useDebouncedValue';
import {
  JOB_FILTER_STATUSES,
  createdRange,
  hasUncountableFilters,
  jobFiltersToQueryString,
  parseJobFilters,
} from './job-list-filters';
import type { JobFilters } from './job-list-filters';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  deadletter: 'Dead Letter',
};

/** The filters typed into text boxes: applied once typing pauses. */
type TextFilterKey = 'search' | 'queue' | 'job_type' | 'tag';
const TEXT_FILTER_KEYS: TextFilterKey[] = ['search', 'queue', 'job_type', 'tag'];
type TextInputs = Record<TextFilterKey, string>;

function initialFilters(): JobFilters {
  if (typeof window === 'undefined') return {};
  return parseJobFilters(window.location.search);
}

function syncFiltersToUrl(filters: JobFilters) {
  if (typeof window === 'undefined') return;
  const qs = jobFiltersToQueryString(filters);
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', next);
}

/** The exact total changes slowly; realtime events never refetch it (see queryKeys.jobTotals). */
const JOB_TOTAL_STALE_MS = 60_000;

function JobsListContent() {
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // The text filters are sent to the server, so a request per keystroke would be a request
  // per keystroke: they apply once typing pauses.
  const [inputs, setInputs] = useState<TextInputs>(() => ({
    search: filters.search ?? '',
    queue: filters.queue ?? '',
    job_type: filters.job_type ?? '',
    tag: filters.tag ?? '',
  }));
  const debouncedInputs = useDebouncedValue(inputs);

  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      for (const key of TEXT_FILTER_KEYS) next[key] = debouncedInputs[key].trim() || undefined;
      return TEXT_FILTER_KEYS.every((key) => prev[key] === next[key]) ? prev : next;
    });
    setPage(1);
  }, [debouncedInputs]);

  useEffect(() => {
    syncFiltersToUrl(filters);
  }, [filters]);

  const listParams = {
    status: filters.status,
    queue: filters.queue,
    job_type: filters.job_type,
    search: filters.search,
    tag: filters.tag,
    ...createdRange(filters.from, filters.to),
  };

  const {
    data: pageData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.jobs.list({ ...listParams, page, per_page: pageSize }),
    queryFn: () => jobsAPI.list({ ...listParams, page, per_page: pageSize }),
    refetchInterval: 10000,
  });

  // `GET /jobs` has no total, so the exact count is its own query: a long staleTime, no
  // polling, and a key outside `jobs` so realtime invalidations leave it alone. Stats count by
  // queue and by one status only; with a search, type, tag or date filter (or when the count
  // is not available) the page has no exact total and paginates by `hasMore` alone.
  const uncountable = hasUncountableFilters(filters);
  const { data: exactTotal } = useQuery({
    queryKey: queryKeys.jobTotals.count({ queue: filters.queue, status: filters.status }),
    queryFn: () => jobsAPI.getListTotal({ queue: filters.queue, status: filters.status }),
    enabled: !uncountable,
    staleTime: JOB_TOTAL_STALE_MS,
    refetchOnMount: true,
    retry: false,
  });
  const data = pageData && !uncountable ? withExactTotal(pageData, exactTotal) : pageData;

  const handleFilterChange = (key: 'status' | 'from' | 'to', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  };

  const handleTextChange = (key: TextFilterKey, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({});
    setInputs({ search: '', queue: '', job_type: '', tag: '' });
    setPage(1);
  };

  const hasFilters =
    Object.values(filters).some((v) => v) || TEXT_FILTER_KEYS.some((key) => inputs[key] !== '');

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
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by job ID prefix, type or queue..."
                aria-label="Search jobs"
                maxLength={255}
                value={inputs.search}
                onChange={(e) => handleTextChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              aria-label="Status"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              {JOB_FILTER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] ?? status}
                </option>
              ))}
            </select>

            <Input
              placeholder="Queue..."
              aria-label="Queue"
              value={inputs.queue}
              onChange={(e) => handleTextChange('queue', e.target.value)}
              className="w-40"
            />

            <Input
              placeholder="Type..."
              aria-label="Job type (exact)"
              title="Exact job type"
              maxLength={255}
              value={inputs.job_type}
              onChange={(e) => handleTextChange('job_type', e.target.value)}
              className="w-40"
            />

            <Input
              placeholder="Tag..."
              aria-label="Tag"
              title="Jobs carrying this tag"
              value={inputs.tag}
              onChange={(e) => handleTextChange('tag', e.target.value)}
              className="w-32"
            />

            <div className="flex items-center gap-2">
              <label htmlFor="jobs-created-from" className="text-xs text-muted-foreground">
                Created from
              </label>
              <Input
                id="jobs-created-from"
                type="date"
                value={filters.from ?? ''}
                max={filters.to || undefined}
                onChange={(e) => handleFilterChange('from', e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="Created to"
                value={filters.to ?? ''}
                min={filters.from || undefined}
                onChange={(e) => handleFilterChange('to', e.target.value)}
                className="w-40"
              />
            </div>

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
          <DataTableError error={error} onRetry={() => refetch()} isRetrying={isFetching} />
        ) : data?.filtersUnsupported ? (
          // The server ignored the search, type or date filter: the rows it sent are not results.
          <div className="p-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{JOBS_FILTER_UNSUPPORTED_MESSAGE}</AlertTitle>
              <AlertDescription>
                Remove the search, type and date filters to list jobs. Queue, status and tag filters
                still work.
              </AlertDescription>
            </Alert>
          </div>
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
                    <DataTableCell muted>{formatRelativeTime(job.created_at)}</DataTableCell>
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
                totalExact={data.totalExact}
                hasMore={data.hasMore}
                itemCount={data.data.length}
              />
            )}
            {data.total > JOBS_LIST_MAX_PAGE * pageSize && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                Paging stops at page {JOBS_LIST_MAX_PAGE}. Narrow the filters to reach older jobs.
              </p>
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
