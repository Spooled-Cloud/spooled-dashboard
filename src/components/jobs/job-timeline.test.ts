import { describe, it, expect } from 'vitest';
import type { Job } from '@/lib/types';
import type { JobHistoryEvent } from '@/lib/api/jobs';
import { buildJobTimeline, humanizeEventType, summarizeHistoryDetails } from './job-timeline';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organization_id: 'org-1',
    queue: 'default',
    job_type: 'send_email',
    payload: {},
    status: 'pending',
    priority: 0,
    attempt: 0,
    max_retries: 3,
    backoff_type: 'exponential',
    created_at: '2026-10-11T10:00:00Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<JobHistoryEvent> & { event_type: string }): JobHistoryEvent {
  return {
    id: `h-${overrides.event_type}-${overrides.created_at ?? ''}`,
    job_id: 'job-1',
    worker_id: null,
    details: {},
    created_at: '2026-10-11T10:00:05Z',
    ...overrides,
  };
}

describe('buildJobTimeline', () => {
  describe('without history (older backend, 404, empty history)', () => {
    it('derives the timeline from the job fields, in the order they happen', () => {
      const job = makeJob({
        status: 'completed',
        scheduled_at: '2026-10-11T10:00:01Z',
        started_at: '2026-10-11T10:00:02Z',
        completed_at: '2026-10-11T10:00:03Z',
      });
      expect(buildJobTimeline(job).map((e) => e.label)).toEqual([
        'Created',
        'Scheduled',
        'Started',
        'Completed',
      ]);
      expect(buildJobTimeline(job, []).map((e) => e.label)).toEqual(
        buildJobTimeline(job, undefined).map((e) => e.label)
      );
    });

    it('shows a cancelled job as cancelled, a dead-lettered job as failed', () => {
      expect(
        buildJobTimeline(
          makeJob({ status: 'cancelled', completed_at: '2026-10-11T10:01:00Z' })
        ).map((e) => e.label)
      ).toEqual(['Created', 'Cancelled']);

      const failed = buildJobTimeline(
        makeJob({ status: 'deadletter', failed_at: '2026-10-11T10:02:00Z' })
      );
      expect(failed.map((e) => e.label)).toEqual(['Created', 'Failed']);
      expect(failed[1].variant).toBe('danger');
    });

    it('adds an inactive Next Retry for a job waiting to retry, without a Scheduled row', () => {
      const entries = buildJobTimeline(
        makeJob({
          scheduled_at: '2026-10-11T10:05:00Z',
          next_retry_at: '2026-10-11T10:05:00Z',
          attempt: 1,
        })
      );
      expect(entries.map((e) => e.label)).toEqual(['Created', 'Next Retry']);
      expect(entries[1].active).toBe(false);
    });
  });

  describe('with history', () => {
    it('shows every recorded event, oldest first, with the worker and a details summary', () => {
      const entries = buildJobTimeline(
        makeJob({ status: 'completed', completed_at: '2026-10-11T10:00:30Z', attempt: 1 }),
        [
          makeEvent({
            event_type: 'processing',
            worker_id: 'worker-1',
            created_at: '2026-10-11T10:00:05Z',
          }),
          makeEvent({
            event_type: 'retry_scheduled',
            worker_id: 'worker-1',
            details: { error: 'Connection refused', retry_count: 1, organization_id: 'org-1' },
            created_at: '2026-10-11T10:00:10Z',
          }),
          makeEvent({
            event_type: 'processing',
            worker_id: 'worker-2',
            created_at: '2026-10-11T10:00:20Z',
          }),
          makeEvent({
            event_type: 'completed',
            worker_id: 'worker-2',
            created_at: '2026-10-11T10:00:30Z',
          }),
        ]
      );

      // Created comes from the job: REST create writes no history row
      expect(entries.map((e) => e.label)).toEqual([
        'Created',
        'Started',
        'Retry scheduled',
        'Started',
        'Completed',
      ]);
      expect(entries[1].workerId).toBe('worker-1');
      expect(entries[2].summary).toBe('retry 1 · error: Connection refused');
      expect(entries[2].variant).toBe('warning');
      expect(entries[4].variant).toBe('success');
      expect(entries[4].workerId).toBe('worker-2');
    });

    it('does not repeat Created when the history has it', () => {
      const entries = buildJobTimeline(makeJob(), [
        makeEvent({ event_type: 'created', created_at: '2026-10-11T10:00:00Z' }),
      ]);
      expect(entries.map((e) => e.label)).toEqual(['Created']);
    });

    it('adds the outcome the history cannot hold: cancel, and a job finished over gRPC', () => {
      const processing = makeEvent({ event_type: 'processing', worker_id: 'w' });

      expect(
        buildJobTimeline(makeJob({ status: 'cancelled', completed_at: '2026-10-11T10:09:00Z' }), [
          processing,
        ]).map((e) => e.label)
      ).toEqual(['Created', 'Started', 'Cancelled']);

      expect(
        buildJobTimeline(makeJob({ status: 'completed', completed_at: '2026-10-11T10:09:00Z' }), [
          processing,
        ]).map((e) => e.label)
      ).toEqual(['Created', 'Started', 'Completed']);
    });

    it('does not duplicate a terminal row the history already has', () => {
      const completed = buildJobTimeline(
        makeJob({ status: 'completed', completed_at: '2026-10-11T10:00:30Z' }),
        [makeEvent({ event_type: 'completed' })]
      );
      expect(completed.filter((e) => e.label === 'Completed')).toHaveLength(1);

      const dead = buildJobTimeline(
        makeJob({ status: 'deadletter', failed_at: '2026-10-11T10:00:30Z' }),
        [makeEvent({ event_type: 'deadlettered', details: { error: 'boom', total_retries: 3 } })]
      );
      expect(dead.map((e) => e.label)).toEqual(['Created', 'Dead-lettered']);
      expect(dead[1].summary).toBe('after 3 retries · error: boom');
      expect(dead[1].variant).toBe('danger');
    });

    it('keeps the upcoming retry after the recorded events', () => {
      const entries = buildJobTimeline(
        makeJob({ scheduled_at: '2026-10-11T10:05:00Z', next_retry_at: '2026-10-11T10:05:00Z' }),
        [makeEvent({ event_type: 'retry_scheduled', details: { retry_count: 1 } })]
      );
      expect(entries.map((e) => e.label)).toEqual(['Created', 'Retry scheduled', 'Next Retry']);
      expect(entries.at(-1)?.active).toBe(false);
    });

    it('shows an event type it does not know in readable form', () => {
      const entries = buildJobTimeline(makeJob(), [
        makeEvent({ event_type: 'lease_extended', details: { extended_by_seconds: 30 } }),
      ]);
      expect(entries[1].label).toBe('Lease extended');
      expect(entries[1].icon).toBe('event');
      expect(entries[1].summary).toBe('extended_by_seconds: 30');
    });

    it('gives every entry a unique key', () => {
      const entries = buildJobTimeline(makeJob({ status: 'cancelled', completed_at: 'x' }), [
        makeEvent({ id: 'a', event_type: 'processing' }),
        makeEvent({ id: 'b', event_type: 'processing' }),
      ]);
      expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    });
  });
});

describe('summarizeHistoryDetails', () => {
  it('words the error, retry number and next run', () => {
    expect(
      summarizeHistoryDetails({
        error: 'Connection refused',
        retry_count: 2,
        next_run: 'not a date',
      })
    ).toBe('retry 2 · next run not a date · error: Connection refused');
  });

  it('says "after 1 retry" in the singular', () => {
    expect(summarizeHistoryDetails({ total_retries: 1 })).toBe('after 1 retry');
  });

  it('hides ids that explain nothing', () => {
    expect(
      summarizeHistoryDetails({
        organization_id: 'org-1',
        worker_id: 'w-1',
        lease_id: 'lease-1',
      })
    ).toBeUndefined();
  });

  it('notes a batch claim', () => {
    expect(summarizeHistoryDetails({ batch_claim: true, lease_id: 'l' })).toBe('batch claim');
    expect(summarizeHistoryDetails({ batch_claim: false })).toBeUndefined();
  });

  it('clips a long error and flattens its whitespace', () => {
    const summary = summarizeHistoryDetails({ error: `line one\n${'x'.repeat(400)}` }) ?? '';
    expect(summary.startsWith('error: line one xxx')).toBe(true);
    expect(summary.length).toBeLessThan(200);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('lists at most three plain extra fields and skips nested ones', () => {
    const summary = summarizeHistoryDetails({
      a: 1,
      b: 'two',
      c: true,
      d: 'four',
      nested: { x: 1 },
    });
    expect(summary).toBe('a: 1 · b: two · c: true');
  });

  it('is undefined for empty details', () => {
    expect(summarizeHistoryDetails({})).toBeUndefined();
  });
});

describe('humanizeEventType', () => {
  it('turns snake case into a sentence', () => {
    expect(humanizeEventType('retry_scheduled')).toBe('Retry scheduled');
    expect(humanizeEventType('lease.expired')).toBe('Lease expired');
    expect(humanizeEventType('')).toBe('Event');
  });
});
