/**
 * Home-page figures the overview payload does not always carry.
 *
 * Backend 0.1.127 omits scheduled job counts, drops workers whose heartbeat
 * is older than a minute, and builds the queue list from job rows (so a
 * configured queue with nothing left to count disappears). A later backend
 * fills those in. These helpers prefer the overview field when it is present
 * and otherwise reconstruct the same number from the list endpoints, which
 * already return the missing rows.
 */

export interface HomeQueueRow {
  name: string;
  pending: number;
  processing: number;
  paused: boolean;
}

export interface WorkerHealthCounts {
  total: number;
  healthy: number;
  unhealthy: number;
  /** Set when the overview itself counts workers past the heartbeat window. */
  offline?: number;
}

export interface ListedWorkerHealth {
  status: string;
  last_heartbeat?: string;
}

/** Heartbeat window the 0.1.127 overview uses to drop a worker from both sides. */
export const OVERVIEW_HEARTBEAT_WINDOW_MS = 60_000;

/** Same cutoff the reaper uses before it stores `offline`. */
export const WORKER_OFFLINE_AFTER_MS = 120_000;

function nonNeg(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function ageMs(lastHeartbeat: string | undefined, now: number): number | null {
  if (!lastHeartbeat) return null;
  const at = Date.parse(lastHeartbeat);
  if (!Number.isFinite(at)) return null;
  return now - at;
}

/**
 * `scheduled` on the overview jobs object, when the backend sends it.
 * `undefined` means the field is absent (0.1.127) and the caller should
 * read `GET /jobs/stats` instead of treating the backlog as zero.
 */
export function scheduledCountFromOverview(
  jobs: { scheduled?: unknown } | undefined
): number | undefined {
  if (!jobs || typeof jobs.scheduled !== 'number' || !Number.isFinite(jobs.scheduled)) {
    return undefined;
  }
  return Math.max(0, jobs.scheduled);
}

/** `scheduled` from `GET /jobs/stats`, or `undefined` when that payload omits it too. */
export function scheduledCountFromStats(
  stats: { scheduled?: unknown } | undefined
): number | undefined {
  if (!stats || typeof stats.scheduled !== 'number' || !Number.isFinite(stats.scheduled)) {
    return undefined;
  }
  return Math.max(0, stats.scheduled);
}

/**
 * Overview queues are job aggregates capped at 20 names. `configured` is
 * `GET /queues` (queue_config). A name only the config list has is shown with
 * an empty backlog; a name the overview already has keeps the overview's
 * pause flag and counts, because that row joined queue_config itself.
 */
export function mergeHomeQueues(
  overview: HomeQueueRow[] | undefined,
  configured: Array<{ name: string; paused: boolean }> | undefined
): HomeQueueRow[] {
  const byName = new Map<string, HomeQueueRow>();
  for (const queue of overview ?? []) {
    if (!queue?.name) continue;
    byName.set(queue.name, {
      name: queue.name,
      pending: nonNeg(queue.pending),
      processing: nonNeg(queue.processing),
      paused: Boolean(queue.paused),
    });
  }
  for (const queue of configured ?? []) {
    if (!queue?.name || byName.has(queue.name)) continue;
    byName.set(queue.name, {
      name: queue.name,
      pending: 0,
      processing: 0,
      paused: Boolean(queue.paused),
    });
  }
  return [...byName.values()];
}

/** Busiest queues, plus any paused queue the backlog slice would hide. */
export function visibleHomeQueues(queues: HomeQueueRow[], limit = 6): HomeQueueRow[] {
  const sorted = [...queues].sort((a, b) => {
    const backlog = b.pending + b.processing - (a.pending + a.processing);
    if (backlog !== 0) return backlog;
    return a.name.localeCompare(b.name);
  });
  const top = sorted.slice(0, limit);
  const shown = new Set(top.map((queue) => queue.name));
  const pausedRest = sorted.filter((queue) => queue.paused && !shown.has(queue.name));
  return [...top, ...pausedRest];
}

/**
 * True when 0.1.127's overview would have dropped this worker: stored
 * `offline`, or no heartbeat inside the one-minute window.
 */
function droppedByMinuteWindow(worker: ListedWorkerHealth, now: number): boolean {
  if (worker.status === 'offline') return true;
  const age = ageMs(worker.last_heartbeat, now);
  return age !== null && age >= OVERVIEW_HEARTBEAT_WINDOW_MS;
}

/**
 * A dropped worker counts as unhealthy once the reaper would (offline,
 * degraded, draining, or silent for two minutes). A healthy worker in the
 * 60–120s gap is still healthy; it is only missing from the old ratio.
 */
function droppedWorkerIsUnhealthy(worker: ListedWorkerHealth, now: number): boolean {
  if (worker.status !== 'active' && worker.status !== 'idle') return true;
  const age = ageMs(worker.last_heartbeat, now);
  return age !== null && age >= WORKER_OFFLINE_AFTER_MS;
}

/**
 * Workers the one-minute overview already counted as unhealthy: degraded or
 * draining with a fresh heartbeat. Their share of `unhealthy` must not be
 * mistaken for a silent worker the overview included.
 */
function unhealthyInsideOverviewWindow(worker: ListedWorkerHealth, now: number): boolean {
  if (droppedByMinuteWindow(worker, now)) return false;
  return worker.status !== 'active' && worker.status !== 'idle';
}

/**
 * Home "workers healthy" ratio.
 *
 * When the overview total already covers every worker the list returned, the
 * backend is counting silent workers itself: use those numbers. Otherwise
 * (0.1.127) add the listed workers the one-minute window dropped. `listed`
 * undefined means the list has not loaded; an empty list is not proof the
 * overview is wrong (the list is capped), so both keep the overview.
 */
export function reconcileWorkerHealth(
  overview: WorkerHealthCounts | undefined,
  listed: ListedWorkerHealth[] | undefined,
  now = Date.now()
): WorkerHealthCounts {
  const healthy = nonNeg(overview?.healthy);
  const reportedUnhealthy = nonNeg(overview?.unhealthy);
  const reportedTotal = nonNeg(overview?.total);

  if (overview && typeof overview.offline === 'number' && Number.isFinite(overview.offline)) {
    const offline = nonNeg(overview.offline);
    const unhealthy = Math.max(reportedUnhealthy, offline);
    return {
      total: Math.max(reportedTotal, healthy + unhealthy),
      healthy,
      unhealthy,
    };
  }

  const base: WorkerHealthCounts = {
    total: reportedTotal,
    healthy,
    unhealthy: reportedUnhealthy,
  };
  if (!listed || listed.length === 0) return base;
  if (base.total >= listed.length) return base;

  const dropped = listed.filter((worker) => droppedByMinuteWindow(worker, now));
  const droppedUnhealthy = dropped.filter((worker) => droppedWorkerIsUnhealthy(worker, now)).length;
  const droppedHealthy = dropped.length - droppedUnhealthy;
  const inWindowUnhealthy = listed.filter((worker) =>
    unhealthyInsideOverviewWindow(worker, now)
  ).length;
  const silentAlreadyCounted = Math.max(0, base.unhealthy - inWindowUnhealthy);
  const silentMissing = Math.max(0, droppedUnhealthy - silentAlreadyCounted);
  const gap = listed.length - base.total;
  const addUnhealthy = Math.min(silentMissing, gap);
  const addHealthy = Math.min(droppedHealthy, gap - addUnhealthy);

  return {
    total: base.total + addUnhealthy + addHealthy,
    healthy: base.healthy + addHealthy,
    unhealthy: base.unhealthy + addUnhealthy,
  };
}
