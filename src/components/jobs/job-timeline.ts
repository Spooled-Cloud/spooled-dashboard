/**
 * Job timeline model.
 *
 * `buildJobTimeline` turns a job (and, when the backend has it, `GET /jobs/{id}/history`) into
 * the rows the job page shows. It is plain data so it can be tested without React; the
 * component maps `icon` names to lucide icons.
 *
 * History rows exist only where backend code writes them (REST claim, complete and fail, the
 * scheduler's dead-letter sweeps), not for every transition, so the job's own fields still
 * supply the facts a history lacks: Created (REST create writes no row), Cancelled (cancel
 * writes none), the outcome of a job finished over gRPC, and the upcoming retry.
 */

import type { Job } from '@/lib/types';
import type { JobHistoryEvent } from '@/lib/api/jobs';
import { formatRelativeTime } from '@/lib/utils/format';

export type TimelineIcon =
  | 'created'
  | 'scheduled'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'retry'
  | 'event';

export type TimelineVariant = 'default' | 'success' | 'danger' | 'warning';

export interface TimelineEntry {
  key: string;
  label: string;
  time: string;
  icon: TimelineIcon;
  /** False for something still to come (the next retry). */
  active: boolean;
  variant?: TimelineVariant;
  /** Worker that took part, from the history row. */
  workerId?: string;
  /** One line about the row's `details` (error, retry number, next run, ...). */
  summary?: string;
}

const EVENT_PRESENTATION: Record<
  string,
  { label: string; icon: TimelineIcon; variant?: TimelineVariant }
> = {
  created: { label: 'Created', icon: 'created' },
  processing: { label: 'Started', icon: 'started' },
  completed: { label: 'Completed', icon: 'completed', variant: 'success' },
  retry_scheduled: { label: 'Retry scheduled', icon: 'retry', variant: 'warning' },
  deadlettered: { label: 'Dead-lettered', icon: 'failed', variant: 'danger' },
  failed: { label: 'Failed', icon: 'failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', icon: 'cancelled', variant: 'warning' },
};

/** `retry_scheduled` -> `Retry scheduled` for an event type this dashboard does not know yet. */
export function humanizeEventType(eventType: string): string {
  const words = eventType.replace(/[_.\-\s]+/g, ' ').trim();
  if (!words) return 'Event';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Detail keys that explain nothing to a person looking at a job. */
const HIDDEN_DETAIL_KEYS = new Set(['organization_id', 'worker_id', 'lease_id']);
/** Detail keys `summarizeHistoryDetails` words itself. */
const WORDED_DETAIL_KEYS = new Set([
  'error',
  'retry_count',
  'total_retries',
  'next_run',
  'batch_claim',
]);
const MAX_SUMMARY_VALUE = 160;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_SUMMARY_VALUE ? `${flat.slice(0, MAX_SUMMARY_VALUE - 1)}…` : flat;
}

function relativeOrRaw(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatRelativeTime(parsed);
}

/**
 * One line about a history row's `details`: the error, which retry it was, when the next run
 * is due. Unknown keys with plain values are listed as `key: value` (at most three), so a new
 * backend event is still readable. Returns `undefined` when there is nothing worth saying.
 */
export function summarizeHistoryDetails(details: Record<string, unknown>): string | undefined {
  const parts: string[] = [];

  if (typeof details.retry_count === 'number') parts.push(`retry ${details.retry_count}`);
  if (typeof details.total_retries === 'number') {
    parts.push(
      details.total_retries === 1 ? 'after 1 retry' : `after ${details.total_retries} retries`
    );
  }
  if (typeof details.next_run === 'string' && details.next_run) {
    parts.push(`next run ${relativeOrRaw(details.next_run)}`);
  }
  if (details.batch_claim === true) parts.push('batch claim');
  if (typeof details.error === 'string' && details.error.trim()) {
    parts.push(`error: ${clip(details.error)}`);
  }

  let extras = 0;
  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_DETAIL_KEYS.has(key) || WORDED_DETAIL_KEYS.has(key)) continue;
    if (extras >= 3) break;
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${key}: ${clip(value)}`);
      extras += 1;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}: ${value}`);
      extras += 1;
    }
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function fromHistoryEvent(event: JobHistoryEvent): TimelineEntry {
  const known = EVENT_PRESENTATION[event.event_type];
  return {
    key: `history:${event.id}`,
    label: known?.label ?? humanizeEventType(event.event_type),
    time: event.created_at,
    icon: known?.icon ?? 'event',
    active: true,
    variant: known?.variant,
    workerId: event.worker_id ?? undefined,
    summary: summarizeHistoryDetails(event.details),
  };
}

function createdEntry(job: Job): TimelineEntry {
  return {
    key: 'job:created',
    label: 'Created',
    time: job.created_at,
    icon: 'created',
    active: true,
  };
}

function terminalEntries(job: Job, has: (type: string) => boolean): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  if (job.status === 'completed' && job.completed_at && !has('completed')) {
    entries.push({
      key: 'job:completed',
      label: 'Completed',
      time: job.completed_at,
      icon: 'completed',
      active: true,
      variant: 'success',
    });
  }
  if (job.status === 'cancelled' && job.completed_at && !has('cancelled')) {
    entries.push({
      key: 'job:cancelled',
      label: 'Cancelled',
      time: job.completed_at,
      icon: 'cancelled',
      active: true,
      variant: 'warning',
    });
  }
  if (
    (job.status === 'failed' || job.status === 'deadletter') &&
    job.failed_at &&
    !has('deadlettered') &&
    !has('failed')
  ) {
    entries.push({
      key: 'job:failed',
      label: 'Failed',
      time: job.failed_at,
      icon: 'failed',
      active: true,
      variant: 'danger',
    });
  }
  return entries;
}

function nextRetryEntry(job: Job): TimelineEntry[] {
  return job.next_retry_at
    ? [
        {
          key: 'job:next-retry',
          label: 'Next Retry',
          time: job.next_retry_at,
          icon: 'retry',
          active: false,
          variant: 'warning',
        },
      ]
    : [];
}

/** What the job's own fields say happened; the whole timeline when there is no history. */
function buildDerivedTimeline(job: Job): TimelineEntry[] {
  return [
    createdEntry(job),
    ...(job.scheduled_at && !job.next_retry_at
      ? [
          {
            key: 'job:scheduled',
            label: 'Scheduled',
            time: job.scheduled_at,
            icon: 'scheduled' as const,
            active: true,
          },
        ]
      : []),
    ...(job.started_at
      ? [
          {
            key: 'job:started',
            label: 'Started',
            time: job.started_at,
            icon: 'started' as const,
            active: true,
          },
        ]
      : []),
    ...terminalEntries(job, () => false),
    ...nextRetryEntry(job),
  ];
}

/**
 * The rows of the job timeline. Without history (older backend, a 404, an empty list) it is
 * derived from the job's fields alone. With history, every recorded event is shown, and the
 * job's fields only add what no row can say.
 */
export function buildJobTimeline(job: Job, history?: JobHistoryEvent[]): TimelineEntry[] {
  if (!history || history.length === 0) return buildDerivedTimeline(job);

  const types = new Set(history.map((event) => event.event_type));
  const has = (type: string) => types.has(type);

  return [
    ...(has('created') ? [] : [createdEntry(job)]),
    ...history.map(fromHistoryEvent),
    ...terminalEntries(job, has),
    ...nextRetryEntry(job),
  ];
}
