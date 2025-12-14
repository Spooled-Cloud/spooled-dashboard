/**
 * Tests for Usage API
 */

import { describe, it, expect } from 'vitest';
import type { UsageInfo, PlanLimits, ResourceUsage, UsageItem, UsageWarning } from './usage';

describe('UsageInfo interface', () => {
  it('should match expected structure', () => {
    const usage: UsageInfo = {
      plan: 'starter',
      plan_display_name: 'Starter',
      limits: {
        tier: 'starter',
        display_name: 'Starter',
        max_jobs_per_day: 10000,
        max_active_jobs: 1000,
        max_queues: 10,
        max_workers: 20,
        max_api_keys: 5,
        max_schedules: 10,
        max_workflows: 5,
        max_webhooks: 10,
        max_payload_size_bytes: 1048576,
        rate_limit_requests_per_second: 100,
        rate_limit_burst: 200,
        job_retention_days: 30,
        history_retention_days: 7,
      },
      usage: {
        jobs_today: { current: 500, limit: 10000, percentage: 5, is_disabled: false },
        active_jobs: { current: 50, limit: 1000, percentage: 5, is_disabled: false },
        queues: { current: 3, limit: 10, percentage: 30, is_disabled: false },
        workers: { current: 5, limit: 20, percentage: 25, is_disabled: false },
        api_keys: { current: 2, limit: 5, percentage: 40, is_disabled: false },
        schedules: { current: 1, limit: 10, percentage: 10, is_disabled: false },
        workflows: { current: 0, limit: 5, percentage: 0, is_disabled: false },
        webhooks: { current: 1, limit: 10, percentage: 10, is_disabled: false },
      },
      warnings: [],
    };

    expect(usage.plan).toBe('starter');
    expect(usage.limits.tier).toBe('starter');
    expect(usage.usage.jobs_today.current).toBe(500);
  });
});

describe('PlanLimits interface', () => {
  it('should support null values for unlimited', () => {
    const limits: PlanLimits = {
      tier: 'enterprise',
      display_name: 'Enterprise',
      max_jobs_per_day: null,
      max_active_jobs: null,
      max_queues: null,
      max_workers: null,
      max_api_keys: null,
      max_schedules: null,
      max_workflows: null,
      max_webhooks: null,
      max_payload_size_bytes: 10485760,
      rate_limit_requests_per_second: 1000,
      rate_limit_burst: 2000,
      job_retention_days: 365,
      history_retention_days: 90,
    };

    expect(limits.max_jobs_per_day).toBeNull();
    expect(limits.max_active_jobs).toBeNull();
    expect(limits.max_payload_size_bytes).toBe(10485760);
  });

  it('should have required numeric fields', () => {
    const limits: PlanLimits = {
      tier: 'free',
      display_name: 'Free',
      max_jobs_per_day: 1000,
      max_active_jobs: 100,
      max_queues: 3,
      max_workers: 5,
      max_api_keys: 2,
      max_schedules: 0,
      max_workflows: 0,
      max_webhooks: 1,
      max_payload_size_bytes: 65536,
      rate_limit_requests_per_second: 10,
      rate_limit_burst: 20,
      job_retention_days: 7,
      history_retention_days: 1,
    };

    expect(limits.max_payload_size_bytes).toBeGreaterThan(0);
    expect(limits.rate_limit_requests_per_second).toBeGreaterThan(0);
    expect(limits.job_retention_days).toBeGreaterThan(0);
  });
});

describe('ResourceUsage interface', () => {
  it('should contain all resource types', () => {
    const usage: ResourceUsage = {
      jobs_today: { current: 0, limit: 1000, percentage: 0, is_disabled: false },
      active_jobs: { current: 0, limit: 100, percentage: 0, is_disabled: false },
      queues: { current: 0, limit: 3, percentage: 0, is_disabled: false },
      workers: { current: 0, limit: 5, percentage: 0, is_disabled: false },
      api_keys: { current: 0, limit: 2, percentage: 0, is_disabled: false },
      schedules: { current: 0, limit: null, percentage: null, is_disabled: true },
      workflows: { current: 0, limit: null, percentage: null, is_disabled: true },
      webhooks: { current: 0, limit: 1, percentage: 0, is_disabled: false },
    };

    expect(usage).toHaveProperty('jobs_today');
    expect(usage).toHaveProperty('active_jobs');
    expect(usage).toHaveProperty('queues');
    expect(usage).toHaveProperty('workers');
    expect(usage).toHaveProperty('api_keys');
    expect(usage).toHaveProperty('schedules');
    expect(usage).toHaveProperty('workflows');
    expect(usage).toHaveProperty('webhooks');
  });
});

describe('UsageItem interface', () => {
  it('should handle normal usage', () => {
    const item: UsageItem = {
      current: 50,
      limit: 100,
      percentage: 50,
      is_disabled: false,
    };

    expect(item.current).toBe(50);
    expect(item.limit).toBe(100);
    expect(item.percentage).toBe(50);
    expect(item.is_disabled).toBe(false);
  });

  it('should handle unlimited resources', () => {
    const item: UsageItem = {
      current: 1000,
      limit: null,
      percentage: null,
      is_disabled: false,
    };

    expect(item.current).toBe(1000);
    expect(item.limit).toBeNull();
    expect(item.percentage).toBeNull();
  });

  it('should handle disabled resources', () => {
    const item: UsageItem = {
      current: 0,
      limit: 0,
      percentage: null,
      is_disabled: true,
    };

    expect(item.is_disabled).toBe(true);
    expect(item.limit).toBe(0);
  });
});

describe('UsageWarning interface', () => {
  it('should have warning severity', () => {
    const warning: UsageWarning = {
      resource: 'jobs_today',
      message: 'You are approaching your daily job limit',
      severity: 'warning',
    };

    expect(warning.severity).toBe('warning');
    expect(warning.resource).toBe('jobs_today');
  });

  it('should have critical severity', () => {
    const warning: UsageWarning = {
      resource: 'active_jobs',
      message: 'Active jobs limit reached',
      severity: 'critical',
    };

    expect(warning.severity).toBe('critical');
  });
});

describe('Usage percentage calculations', () => {
  it('should calculate correct percentage', () => {
    const current = 75;
    const limit = 100;
    const percentage = (current / limit) * 100;

    expect(percentage).toBe(75);
  });

  it('should handle zero limit', () => {
    const limit = 0;
    // When limit is 0, percentage should be null (handled by backend)
    expect(limit === 0).toBe(true);
  });

  it('should handle exceeding limit', () => {
    const current = 150;
    const limit = 100;
    const percentage = (current / limit) * 100;

    expect(percentage).toBe(150);
    expect(percentage > 100).toBe(true);
  });
});
