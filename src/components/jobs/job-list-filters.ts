/**
 * Filters of the jobs list page: what the URL carries, and how they become API parameters.
 * Plain functions so they can be tested without React.
 */

import type { JobStatus } from '@/lib/types';

export interface JobFilters {
  status?: JobStatus;
  queue?: string;
  /** Exact `payload.job_type`. */
  job_type?: string;
  /** Free-text `q`: job id prefix, queue or job type. */
  search?: string;
  tag?: string;
  /** First day of the created window, `YYYY-MM-DD` in the browser's time zone (inclusive). */
  from?: string;
  /** Last day of the created window, `YYYY-MM-DD` in the browser's time zone (inclusive). */
  to?: string;
}

/**
 * Statuses a job can be filtered by. `failed` is not one of them: no job ever gets that status
 * (a job that runs out of retries is `deadletter`), so the filter could only ever be empty.
 */
export const JOB_FILTER_STATUSES: JobStatus[] = [
  'pending',
  'scheduled',
  'processing',
  'completed',
  'cancelled',
  'deadletter',
];

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `YYYY-MM-DD` string that names a real calendar day, or `undefined`. */
function validDay(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = DAY_RE.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? value : undefined;
}

/**
 * Read the filters out of a query string. A link from before 0.1.75 (`?status=failed`, which
 * the dashboard's own "Recent failures" used to emit) means the dead-letter list today.
 */
export function parseJobFilters(queryString: string): JobFilters {
  const params = new URLSearchParams(queryString);
  const rawStatus = params.get('status')?.toLowerCase();
  const wanted = rawStatus === 'failed' ? 'deadletter' : rawStatus;
  const status = (JOB_FILTER_STATUSES as string[]).includes(wanted ?? '')
    ? (wanted as JobStatus)
    : undefined;
  return {
    status,
    queue: params.get('queue') || undefined,
    job_type: params.get('job_type') || undefined,
    search: params.get('search') || params.get('q') || undefined,
    tag: params.get('tag') || undefined,
    from: validDay(params.get('from')),
    to: validDay(params.get('to')),
  };
}

/** The query string (without `?`) that restores `filters`. */
export function jobFiltersToQueryString(filters: JobFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.queue) params.set('queue', filters.queue);
  if (filters.job_type) params.set('job_type', filters.job_type);
  if (filters.search) params.set('search', filters.search);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

function localDay(day: string, plusDays: number): Date | undefined {
  const match = DAY_RE.exec(day);
  if (!validDay(day) || !match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + plusDays);
}

/**
 * The created window as the API wants it: RFC 3339 instants, `created_after` inclusive and
 * `created_before` exclusive. The day pickers are inclusive on both ends, so the end is the
 * start of the day after `to`. Instants go out in UTC (`Z`), so no `+` offset has to survive
 * a query string.
 */
export function createdRange(
  from?: string,
  to?: string
): { created_after?: string; created_before?: string } {
  const start = from ? localDay(from, 0) : undefined;
  const end = to ? localDay(to, 1) : undefined;
  return {
    created_after: start?.toISOString(),
    created_before: end?.toISOString(),
  };
}

/**
 * Filters the exact total from `GET /jobs/stats` cannot describe: stats count by queue and by
 * one status only, so with any of these the list proves its own total from the rows it reads.
 */
export function hasUncountableFilters(filters: JobFilters): boolean {
  return Boolean(filters.search || filters.job_type || filters.tag || filters.from || filters.to);
}
