/**
 * Tests for Query Client Configuration
 */

import { describe, it, expect } from 'vitest';
import { queryClient, queryKeys } from './query-client';

describe('queryClient', () => {
  it('should be a QueryClient instance', () => {
    expect(queryClient).toBeDefined();
    expect(queryClient.getDefaultOptions).toBeDefined();
  });

  it('should have correct default query options', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(30 * 1000);
    expect(options.queries?.gcTime).toBe(5 * 60 * 1000);
    expect(options.queries?.retry).toBe(3);
  });

  it('should have mutation retry option', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.mutations?.retry).toBe(1);
  });
});

describe('queryKeys', () => {
  describe('dashboard', () => {
    it('should have all key', () => {
      expect(queryKeys.dashboard.all).toEqual(['dashboard']);
    });

    it('should have overview key', () => {
      expect(queryKeys.dashboard.overview()).toEqual(['dashboard', 'overview']);
    });
  });

  describe('jobs', () => {
    it('should have all key', () => {
      expect(queryKeys.jobs.all).toEqual(['jobs']);
    });

    it('should have lists key', () => {
      expect(queryKeys.jobs.lists()).toEqual(['jobs', 'list']);
    });

    it('should have list key with filters', () => {
      const filters = { status: 'pending', queue: 'default' };
      expect(queryKeys.jobs.list(filters)).toEqual(['jobs', 'list', filters]);
    });

    it('should have details key', () => {
      expect(queryKeys.jobs.details()).toEqual(['jobs', 'detail']);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.jobs.detail('job-123')).toEqual(['jobs', 'detail', 'job-123']);
    });

    it('should have stats key', () => {
      expect(queryKeys.jobs.stats()).toEqual(['jobs', 'stats']);
    });
  });

  describe('queues', () => {
    it('should have all key', () => {
      expect(queryKeys.queues.all).toEqual(['queues']);
    });

    it('should have list key', () => {
      expect(queryKeys.queues.list()).toEqual(['queues', 'list']);
    });

    it('should have detail key with name', () => {
      expect(queryKeys.queues.detail('emails')).toEqual(['queues', 'detail', 'emails']);
    });

    it('should have stats key with name', () => {
      expect(queryKeys.queues.stats('emails')).toEqual(['queues', 'stats', 'emails']);
    });
  });

  describe('workers', () => {
    it('should have all key', () => {
      expect(queryKeys.workers.all).toEqual(['workers']);
    });

    it('should have list key', () => {
      expect(queryKeys.workers.list()).toEqual(['workers', 'list']);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.workers.detail('worker-1')).toEqual(['workers', 'detail', 'worker-1']);
    });
  });

  describe('workflows', () => {
    it('should have all key', () => {
      expect(queryKeys.workflows.all).toEqual(['workflows']);
    });

    it('should have list key with filters', () => {
      const filters = { status: 'running' };
      expect(queryKeys.workflows.list(filters)).toEqual(['workflows', 'list', filters]);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.workflows.detail('wf-1')).toEqual(['workflows', 'detail', 'wf-1']);
    });
  });

  describe('schedules', () => {
    it('should have all key', () => {
      expect(queryKeys.schedules.all).toEqual(['schedules']);
    });

    it('should have list key', () => {
      expect(queryKeys.schedules.list()).toEqual(['schedules', 'list']);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.schedules.detail('sched-1')).toEqual(['schedules', 'detail', 'sched-1']);
    });

    it('should have history key with id', () => {
      expect(queryKeys.schedules.history('sched-1')).toEqual(['schedules', 'history', 'sched-1']);
    });
  });

  describe('apiKeys', () => {
    it('should have all key', () => {
      expect(queryKeys.apiKeys.all).toEqual(['api-keys']);
    });

    it('should have list key', () => {
      expect(queryKeys.apiKeys.list()).toEqual(['api-keys', 'list']);
    });
  });

  describe('webhooks', () => {
    it('should have all key', () => {
      expect(queryKeys.webhooks.all).toEqual(['webhooks']);
    });

    it('should have list key', () => {
      expect(queryKeys.webhooks.list()).toEqual(['webhooks', 'list']);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.webhooks.detail('wh-1')).toEqual(['webhooks', 'detail', 'wh-1']);
    });

    it('should have deliveries key with id', () => {
      expect(queryKeys.webhooks.deliveries('wh-1')).toEqual(['webhooks', 'deliveries', 'wh-1']);
    });
  });

  describe('organizations', () => {
    it('should have all key', () => {
      expect(queryKeys.organizations.all).toEqual(['organizations']);
    });

    it('should have list key', () => {
      expect(queryKeys.organizations.list()).toEqual(['organizations', 'list']);
    });

    it('should have detail key with id', () => {
      expect(queryKeys.organizations.detail('org-1')).toEqual(['organizations', 'detail', 'org-1']);
    });

    it('should have members key with id', () => {
      expect(queryKeys.organizations.members('org-1')).toEqual([
        'organizations',
        'members',
        'org-1',
      ]);
    });
  });
});
