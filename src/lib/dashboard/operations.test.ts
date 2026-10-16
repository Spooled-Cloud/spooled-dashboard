import { describe, expect, it } from 'vitest';
import {
  mergeHomeQueues,
  reconcileWorkerHealth,
  scheduledCountFromOverview,
  scheduledCountFromStats,
  visibleHomeQueues,
  type ListedWorkerHealth,
} from './operations';

const NOW = Date.parse('2026-10-16T12:00:00Z');

function at(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

function listed(status: string, msAgo: number): ListedWorkerHealth {
  return { status, last_heartbeat: at(msAgo) };
}

describe('scheduled counts', () => {
  it('reads a finite overview field, including zero, and ignores anything else', () => {
    expect(scheduledCountFromOverview({ scheduled: 0 })).toBe(0);
    expect(scheduledCountFromOverview({ scheduled: 12 })).toBe(12);
    expect(scheduledCountFromOverview({})).toBeUndefined();
    expect(scheduledCountFromOverview({ scheduled: '4' })).toBeUndefined();
    expect(scheduledCountFromOverview(undefined)).toBeUndefined();
  });

  it('reads scheduled from job stats the same way', () => {
    expect(scheduledCountFromStats({ scheduled: 7 })).toBe(7);
    expect(scheduledCountFromStats({})).toBeUndefined();
  });
});

describe('mergeHomeQueues', () => {
  it('adds a configured queue the overview omitted and keeps overview counts', () => {
    const merged = mergeHomeQueues(
      [{ name: 'emails', pending: 3, processing: 1, paused: false }],
      [
        { name: 'emails', paused: true },
        { name: 'billing', paused: true },
      ]
    );
    expect(merged).toEqual([
      { name: 'emails', pending: 3, processing: 1, paused: false },
      { name: 'billing', pending: 0, processing: 0, paused: true },
    ]);
  });

  it('keeps a paused empty queue visible past the backlog slice', () => {
    const busy = Array.from({ length: 6 }, (_, i) => ({
      name: `q${i}`,
      pending: 10 - i,
      processing: 0,
      paused: false,
    }));
    const visible = visibleHomeQueues([
      ...busy,
      { name: 'billing', pending: 0, processing: 0, paused: true },
    ]);
    expect(visible.map((queue) => queue.name)).toContain('billing');
    expect(visible).toHaveLength(7);
  });
});

describe('reconcileWorkerHealth', () => {
  it('adds an offline worker the one-minute overview dropped', () => {
    const health = reconcileWorkerHealth(
      { total: 4, healthy: 4, unhealthy: 0 },
      [
        listed('active', 5_000),
        listed('active', 5_000),
        listed('idle', 5_000),
        listed('active', 5_000),
        listed('offline', 5 * 60_000),
      ],
      NOW
    );
    expect(health).toMatchObject({ total: 5, healthy: 4, unhealthy: 1 });
  });

  it('counts a worker silent for two minutes as unhealthy even while its status is still active', () => {
    const health = reconcileWorkerHealth(
      { total: 1, healthy: 1, unhealthy: 0 },
      [listed('active', 5_000), listed('active', 3 * 60_000)],
      NOW
    );
    expect(health).toMatchObject({ total: 2, healthy: 1, unhealthy: 1 });
  });

  it('keeps a worker in the 60–120s gap healthy and in the ratio', () => {
    const health = reconcileWorkerHealth(
      { total: 1, healthy: 1, unhealthy: 0 },
      [listed('active', 5_000), listed('idle', 90_000)],
      NOW
    );
    expect(health).toMatchObject({ total: 2, healthy: 2, unhealthy: 0 });
  });

  it('does not let an in-window degraded worker hide a dropped offline worker', () => {
    const health = reconcileWorkerHealth(
      { total: 2, healthy: 1, unhealthy: 1 },
      [listed('active', 5_000), listed('degraded', 5_000), listed('offline', 5 * 60_000)],
      NOW
    );
    expect(health).toMatchObject({ total: 3, healthy: 1, unhealthy: 2 });
  });

  it('trusts an overview that already covers the list', () => {
    const health = reconcileWorkerHealth(
      { total: 5, healthy: 4, unhealthy: 1 },
      [listed('active', 5_000), listed('offline', 5 * 60_000)],
      NOW
    );
    expect(health).toEqual({ total: 5, healthy: 4, unhealthy: 1 });
  });

  it('trusts an explicit offline count from a newer overview', () => {
    const health = reconcileWorkerHealth(
      { total: 4, healthy: 4, unhealthy: 0, offline: 1 },
      [listed('offline', 5 * 60_000), listed('offline', 5 * 60_000)],
      NOW
    );
    expect(health).toMatchObject({ total: 5, healthy: 4, unhealthy: 1 });
  });

  it('keeps the overview until the worker list has loaded', () => {
    expect(reconcileWorkerHealth({ total: 4, healthy: 4, unhealthy: 0 }, undefined, NOW)).toEqual({
      total: 4,
      healthy: 4,
      unhealthy: 0,
    });
  });
});
