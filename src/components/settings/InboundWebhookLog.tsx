import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/data-table';
import { useDebouncedValue } from '@/components/jobs/useDebouncedValue';
import { inboundWebhooksAPI } from '@/lib/api/webhooks';
import type { InboundDeliveryStatus, InboundWebhookDelivery } from '@/lib/api/webhooks';
import { APIError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth';
import { isQueueScopedKey } from '@/lib/utils/key-scope';
import { formatDateTime, formatJobId, formatRelativeTime } from '@/lib/utils/format';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

/** Rows per page; one more is requested to learn whether another page follows. */
export const INBOUND_LOG_PAGE_SIZE = 25;

/** "Since" choices. The window is measured when the list is read, not when it is chosen. */
const SINCE_OPTIONS: { value: string; label: string; ms: number | null }[] = [
  { value: '', label: 'Any time', ms: null },
  { value: '1h', label: 'Last hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

function sinceInstant(value: string): string | undefined {
  const option = SINCE_OPTIONS.find((o) => o.value === value);
  return option?.ms ? new Date(Date.now() - option.ms).toISOString() : undefined;
}

/**
 * The log is organization-wide, so the backend refuses queue-scoped keys (403) and a backend
 * older than 0.1.122 has no such route (404/405). Either way the section is not for this user.
 */
function isUnavailable(error: unknown): boolean {
  return error instanceof APIError && [403, 404, 405].includes(error.status);
}

function absoluteTime(value: string): string | undefined {
  try {
    return formatDateTime(value);
  } catch {
    return undefined;
  }
}

function DeliveryStatusBadge({ status }: { status: InboundWebhookDelivery['status'] }) {
  if (status === 'created') {
    return (
      <Badge className="border-green-500 bg-green-500/10 text-green-700" title="A new job">
        Created
      </Badge>
    );
  }
  if (status === 'duplicate') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600"
        title="The idempotency key matched a job that already existed"
      >
        Duplicate
      </Badge>
    );
  }
  return (
    <span className="text-muted-foreground" title="Recorded before the outcome was tracked">
      —
    </span>
  );
}

/**
 * Incoming webhook log: the requests Spooled accepted on the organization's
 * `/webhooks/{org_id}/custom` URL, newest first, with the job each one created or matched.
 * Payloads and signatures are never part of it. Hidden for queue-scoped keys and for a backend
 * without the route.
 */
export function InboundWebhookLog() {
  const keyQueues = useAuthStore((s) => s.user?.queues);
  const queueScoped = isQueueScopedKey(keyQueues);

  const [status, setStatus] = useState<InboundDeliveryStatus | ''>('');
  const [since, setSince] = useState('');
  const [queueInput, setQueueInput] = useState('');
  const queue = useDebouncedValue(queueInput.trim());
  const [page, setPage] = useState(1);

  // The queue filter applies once typing pauses; a new filter starts again at page 1.
  useEffect(() => {
    setPage(1);
  }, [queue]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.inboundWebhooks.list({ status, since, queue, page }),
    queryFn: async () => {
      const offset = (page - 1) * INBOUND_LOG_PAGE_SIZE;
      const rows = await inboundWebhooksAPI.listDeliveries({
        status: status || undefined,
        since: sinceInstant(since),
        queue_name: queue || undefined,
        limit: INBOUND_LOG_PAGE_SIZE + 1,
        offset,
      });
      return {
        rows: rows.slice(0, INBOUND_LOG_PAGE_SIZE),
        hasMore: rows.length > INBOUND_LOG_PAGE_SIZE,
      };
    },
    enabled: !queueScoped,
    retry: false,
  });

  if (queueScoped || isUnavailable(error)) return null;

  const hasFilters = Boolean(status || since || queue || queueInput);
  const rows = data?.rows ?? [];

  const clearFilters = () => {
    setStatus('');
    setSince('');
    setQueueInput('');
    setPage(1);
  };

  return (
    <Card data-testid="inbound-webhook-log" id="incoming-webhook-log">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Incoming webhook log</CardTitle>
          <CardDescription>
            Requests Spooled accepted on your incoming webhook URL, newest first, with the job each
            one created. Requests with a wrong token or over the rate limit are not logged, and
            payloads are not shown.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Outcome"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InboundDeliveryStatus | '');
              setPage(1);
            }}
          >
            <option value="">All outcomes</option>
            <option value="created">Created</option>
            <option value="duplicate">Duplicate</option>
          </select>
          <select
            aria-label="Received"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setPage(1);
            }}
          >
            {SINCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Queue..."
            aria-label="Queue"
            value={queueInput}
            onChange={(e) => setQueueInput(e.target.value)}
            className="w-44"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        <DataTableContainer>
          {isLoading ? (
            <DataTableLoading rows={4} columns={5} />
          ) : error ? (
            <DataTableError error={error} onRetry={() => refetch()} isRetrying={isFetching} />
          ) : rows.length === 0 ? (
            <DataTableEmpty
              title="No incoming webhook requests"
              description={
                hasFilters
                  ? 'No accepted request matches these filters.'
                  : 'Requests sent to your incoming webhook URL appear here.'
              }
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
            />
          ) : (
            <>
              <DataTable stickyHeader={false}>
                <DataTableHeader sticky={false}>
                  <tr>
                    <DataTableHead>Received</DataTableHead>
                    <DataTableHead>Event</DataTableHead>
                    <DataTableHead>Queue</DataTableHead>
                    <DataTableHead>Job</DataTableHead>
                    <DataTableHead>Outcome</DataTableHead>
                  </tr>
                </DataTableHeader>
                <tbody className="divide-y">
                  {rows.map((delivery) => (
                    <DataTableRow key={delivery.id}>
                      <DataTableCell muted>
                        <span title={absoluteTime(delivery.created_at)}>
                          {formatRelativeTime(delivery.created_at)}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-medium">{delivery.event_type}</span>
                      </DataTableCell>
                      <DataTableCell>
                        {delivery.matched_queue ? (
                          <Badge variant="outline" className="text-xs">
                            {delivery.matched_queue}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell mono>
                        {delivery.job_id ? (
                          <a
                            href={`/jobs/${delivery.job_id}`}
                            className="hover:text-primary hover:underline"
                            title={delivery.job_id}
                          >
                            {formatJobId(delivery.job_id, 12)}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <DeliveryStatusBadge status={delivery.status} />
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </tbody>
              </DataTable>

              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page}
                  {data?.hasMore ? '' : ' (last page)'}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data?.hasMore}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DataTableContainer>
      </CardContent>
    </Card>
  );
}
