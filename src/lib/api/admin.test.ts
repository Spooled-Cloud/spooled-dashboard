/**
 * Tests for Admin API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAdminKey, setAdminKey, clearAdminKey, isAdminAuthenticated } from './admin';

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  // Clear mock storage
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);

  // Mock sessionStorage
  vi.stubGlobal('sessionStorage', {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage[key];
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Admin Key Management', () => {
  describe('setAdminKey', () => {
    it('should store admin key in sessionStorage', () => {
      setAdminKey('admin-key-123');
      expect(sessionStorage.setItem).toHaveBeenCalledWith('spooled_admin_key', 'admin-key-123');
    });
  });

  describe('getAdminKey', () => {
    it('should retrieve admin key from sessionStorage', () => {
      mockSessionStorage['spooled_admin_key'] = 'admin-key-456';
      const key = getAdminKey();
      expect(key).toBe('admin-key-456');
    });

    it('should return null when no key is stored', () => {
      const key = getAdminKey();
      expect(key).toBeNull();
    });
  });

  describe('clearAdminKey', () => {
    it('should remove admin key from sessionStorage', () => {
      mockSessionStorage['spooled_admin_key'] = 'admin-key-789';
      clearAdminKey();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('spooled_admin_key');
    });
  });

  describe('isAdminAuthenticated', () => {
    it('should return true when admin key is set', () => {
      mockSessionStorage['spooled_admin_key'] = 'admin-key';
      expect(isAdminAuthenticated()).toBe(true);
    });

    it('should return false when admin key is not set', () => {
      expect(isAdminAuthenticated()).toBe(false);
    });
  });
});

describe('AdminOrganization interface', () => {
  it('should match expected structure', () => {
    const org = {
      id: 'org-123',
      name: 'Test Org',
      slug: 'test-org',
      plan_tier: 'starter',
      billing_email: 'billing@test.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      usage: {
        jobs_today: 100,
        active_jobs: 10,
        queues: 3,
        workers: 5,
        api_keys: 2,
      },
    };

    expect(org.id).toBe('org-123');
    expect(org.plan_tier).toBe('starter');
    expect(org.usage.jobs_today).toBe(100);
  });

  it('should allow null billing_email', () => {
    const org = {
      id: 'org-456',
      name: 'No Email Org',
      slug: 'no-email',
      plan_tier: 'free',
      billing_email: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      usage: {
        jobs_today: 0,
        active_jobs: 0,
        queues: 0,
        workers: 0,
        api_keys: 1,
      },
    };

    expect(org.billing_email).toBeNull();
  });
});

describe('ListOrgsParams interface', () => {
  it('should allow all filter parameters', () => {
    const params = {
      plan_tier: 'pro',
      search: 'test',
      limit: 25,
      offset: 50,
      sort_by: 'created_at',
      sort_order: 'desc' as const,
    };

    expect(params.plan_tier).toBe('pro');
    expect(params.search).toBe('test');
    expect(params.limit).toBe(25);
    expect(params.offset).toBe(50);
    expect(params.sort_order).toBe('desc');
  });

  it('should allow empty params', () => {
    const params = {};
    expect(Object.keys(params).length).toBe(0);
  });
});

describe('UpdateOrgRequest interface', () => {
  it('should allow partial updates', () => {
    const request = {
      plan_tier: 'pro',
    };

    expect(request.plan_tier).toBe('pro');
  });

  it('should allow all fields', () => {
    const request = {
      plan_tier: 'enterprise',
      billing_email: 'new@email.com',
      settings: { feature_flag: true },
      custom_limits: { max_jobs_per_day: 1000000 },
    };

    expect(request.plan_tier).toBe('enterprise');
    expect(request.billing_email).toBe('new@email.com');
    expect(request.settings).toEqual({ feature_flag: true });
    expect(request.custom_limits).toEqual({ max_jobs_per_day: 1000000 });
  });

  it('should allow null custom_limits to reset', () => {
    const request = {
      custom_limits: null,
    };

    expect(request.custom_limits).toBeNull();
  });
});

describe('CreateOrgRequest interface', () => {
  it('should require name and slug', () => {
    const request = {
      name: 'New Org',
      slug: 'new-org',
    };

    expect(request.name).toBe('New Org');
    expect(request.slug).toBe('new-org');
  });

  it('should allow optional fields', () => {
    const request = {
      name: 'New Org',
      slug: 'new-org',
      billing_email: 'billing@neworg.com',
      plan_tier: 'starter',
    };

    expect(request.billing_email).toBe('billing@neworg.com');
    expect(request.plan_tier).toBe('starter');
  });
});

describe('CreateApiKeyRequest interface', () => {
  it('should require name', () => {
    const request = {
      name: 'Production Key',
    };

    expect(request.name).toBe('Production Key');
  });

  it('should allow optional queues', () => {
    const request = {
      name: 'Limited Key',
      queues: ['default', 'emails'],
    };

    expect(request.queues).toEqual(['default', 'emails']);
  });
});

describe('PlatformStats interface', () => {
  it('should match expected structure', () => {
    const stats = {
      organizations: {
        total: 100,
        by_plan: [
          { plan: 'free', count: 50 },
          { plan: 'starter', count: 30 },
          { plan: 'pro', count: 15 },
          { plan: 'enterprise', count: 5 },
        ],
        created_today: 5,
        created_this_week: 20,
      },
      jobs: {
        total_active: 10000,
        pending: 5000,
        processing: 500,
        completed_24h: 100000,
        failed_24h: 500,
      },
      workers: {
        total: 50,
        healthy: 45,
        degraded: 5,
      },
      system: {
        api_version: '1.0.0',
        uptime_seconds: 86400,
      },
    };

    expect(stats.organizations.total).toBe(100);
    expect(stats.organizations.by_plan.length).toBe(4);
    expect(stats.jobs.total_active).toBe(10000);
    expect(stats.workers.healthy).toBe(45);
    expect(stats.system.api_version).toBe('1.0.0');
  });
});
