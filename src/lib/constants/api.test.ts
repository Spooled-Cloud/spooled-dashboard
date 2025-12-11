/**
 * Tests for API Constants
 */

import { describe, it, expect } from 'vitest';
import { API_BASE_URL, WS_BASE_URL, API_ENDPOINTS, DEFAULT_HEADERS, HTTP_STATUS } from './api';

describe('API Constants', () => {
  describe('API_BASE_URL', () => {
    it('should have a default value', () => {
      expect(API_BASE_URL).toBeDefined();
      expect(typeof API_BASE_URL).toBe('string');
    });
  });

  describe('WS_BASE_URL', () => {
    it('should have a default value', () => {
      expect(WS_BASE_URL).toBeDefined();
      expect(typeof WS_BASE_URL).toBe('string');
    });
  });

  describe('DEFAULT_HEADERS', () => {
    it('should have Content-Type header', () => {
      expect(DEFAULT_HEADERS['Content-Type']).toBe('application/json');
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have correct success codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    });

    it('should have correct client error codes', () => {
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    });

    it('should have correct server error codes', () => {
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });
});

describe('API_ENDPOINTS', () => {
  describe('AUTH', () => {
    it('should have all auth endpoints', () => {
      expect(API_ENDPOINTS.AUTH.LOGIN).toBe('/api/v1/auth/login');
      expect(API_ENDPOINTS.AUTH.REFRESH).toBe('/api/v1/auth/refresh');
      expect(API_ENDPOINTS.AUTH.LOGOUT).toBe('/api/v1/auth/logout');
      expect(API_ENDPOINTS.AUTH.ME).toBe('/api/v1/auth/me');
      expect(API_ENDPOINTS.AUTH.VALIDATE).toBe('/api/v1/auth/validate');
    });
  });

  describe('DASHBOARD', () => {
    it('should have dashboard endpoint', () => {
      expect(API_ENDPOINTS.DASHBOARD).toBe('/api/v1/dashboard');
    });
  });

  describe('JOBS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.JOBS.LIST).toBe('/api/v1/jobs');
      expect(API_ENDPOINTS.JOBS.CREATE).toBe('/api/v1/jobs');
      expect(API_ENDPOINTS.JOBS.STATS).toBe('/api/v1/jobs/stats');
      expect(API_ENDPOINTS.JOBS.STATUS).toBe('/api/v1/jobs/status');
      expect(API_ENDPOINTS.JOBS.BULK).toBe('/api/v1/jobs/bulk');
      expect(API_ENDPOINTS.JOBS.DLQ).toBe('/api/v1/jobs/dlq');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.JOBS.GET('job-123')).toBe('/api/v1/jobs/job-123');
      expect(API_ENDPOINTS.JOBS.DELETE('job-123')).toBe('/api/v1/jobs/job-123');
      expect(API_ENDPOINTS.JOBS.RETRY('job-123')).toBe('/api/v1/jobs/job-123/retry');
      expect(API_ENDPOINTS.JOBS.CANCEL('job-123')).toBe('/api/v1/jobs/job-123/cancel');
    });
  });

  describe('QUEUES', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.QUEUES.LIST).toBe('/api/v1/queues');
      expect(API_ENDPOINTS.QUEUES.CREATE).toBe('/api/v1/queues');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.QUEUES.GET('emails')).toBe('/api/v1/queues/emails');
      expect(API_ENDPOINTS.QUEUES.UPDATE('emails')).toBe('/api/v1/queues/emails');
      expect(API_ENDPOINTS.QUEUES.DELETE('emails')).toBe('/api/v1/queues/emails');
      expect(API_ENDPOINTS.QUEUES.STATS('emails')).toBe('/api/v1/queues/emails/stats');
      expect(API_ENDPOINTS.QUEUES.PAUSE('emails')).toBe('/api/v1/queues/emails/pause');
      expect(API_ENDPOINTS.QUEUES.RESUME('emails')).toBe('/api/v1/queues/emails/resume');
      expect(API_ENDPOINTS.QUEUES.PURGE('emails')).toBe('/api/v1/queues/emails/purge');
    });
  });

  describe('WORKERS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.WORKERS.LIST).toBe('/api/v1/workers');
      expect(API_ENDPOINTS.WORKERS.REGISTER).toBe('/api/v1/workers');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.WORKERS.GET('w-1')).toBe('/api/v1/workers/w-1');
      expect(API_ENDPOINTS.WORKERS.HEARTBEAT('w-1')).toBe('/api/v1/workers/w-1/heartbeat');
      expect(API_ENDPOINTS.WORKERS.DEREGISTER('w-1')).toBe('/api/v1/workers/w-1');
    });
  });

  describe('WORKFLOWS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.WORKFLOWS.LIST).toBe('/api/v1/workflows');
      expect(API_ENDPOINTS.WORKFLOWS.CREATE).toBe('/api/v1/workflows');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.WORKFLOWS.GET('wf-1')).toBe('/api/v1/workflows/wf-1');
      expect(API_ENDPOINTS.WORKFLOWS.CANCEL('wf-1')).toBe('/api/v1/workflows/wf-1/cancel');
      expect(API_ENDPOINTS.WORKFLOWS.RETRY('wf-1')).toBe('/api/v1/workflows/wf-1/retry');
    });
  });

  describe('SCHEDULES', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.SCHEDULES.LIST).toBe('/api/v1/schedules');
      expect(API_ENDPOINTS.SCHEDULES.CREATE).toBe('/api/v1/schedules');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.SCHEDULES.GET('s-1')).toBe('/api/v1/schedules/s-1');
      expect(API_ENDPOINTS.SCHEDULES.UPDATE('s-1')).toBe('/api/v1/schedules/s-1');
      expect(API_ENDPOINTS.SCHEDULES.DELETE('s-1')).toBe('/api/v1/schedules/s-1');
      expect(API_ENDPOINTS.SCHEDULES.TRIGGER('s-1')).toBe('/api/v1/schedules/s-1/trigger');
      expect(API_ENDPOINTS.SCHEDULES.PAUSE('s-1')).toBe('/api/v1/schedules/s-1/pause');
      expect(API_ENDPOINTS.SCHEDULES.RESUME('s-1')).toBe('/api/v1/schedules/s-1/resume');
      expect(API_ENDPOINTS.SCHEDULES.HISTORY('s-1')).toBe('/api/v1/schedules/s-1/history');
    });
  });

  describe('API_KEYS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.API_KEYS.LIST).toBe('/api/v1/api-keys');
      expect(API_ENDPOINTS.API_KEYS.CREATE).toBe('/api/v1/api-keys');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.API_KEYS.GET('k-1')).toBe('/api/v1/api-keys/k-1');
      expect(API_ENDPOINTS.API_KEYS.REVOKE('k-1')).toBe('/api/v1/api-keys/k-1');
    });
  });

  describe('WEBHOOKS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.WEBHOOKS.LIST).toBe('/api/v1/outgoing-webhooks');
      expect(API_ENDPOINTS.WEBHOOKS.CREATE).toBe('/api/v1/outgoing-webhooks');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.WEBHOOKS.GET('wh-1')).toBe('/api/v1/outgoing-webhooks/wh-1');
      expect(API_ENDPOINTS.WEBHOOKS.UPDATE('wh-1')).toBe('/api/v1/outgoing-webhooks/wh-1');
      expect(API_ENDPOINTS.WEBHOOKS.DELETE('wh-1')).toBe('/api/v1/outgoing-webhooks/wh-1');
      expect(API_ENDPOINTS.WEBHOOKS.TEST('wh-1')).toBe('/api/v1/outgoing-webhooks/wh-1/test');
      expect(API_ENDPOINTS.WEBHOOKS.DELIVERIES('wh-1')).toBe(
        '/api/v1/outgoing-webhooks/wh-1/deliveries'
      );
    });
  });

  describe('ORGANIZATIONS', () => {
    it('should have static endpoints', () => {
      expect(API_ENDPOINTS.ORGANIZATIONS.LIST).toBe('/api/v1/organizations');
      expect(API_ENDPOINTS.ORGANIZATIONS.CREATE).toBe('/api/v1/organizations');
    });

    it('should have dynamic endpoints', () => {
      expect(API_ENDPOINTS.ORGANIZATIONS.GET('org-1')).toBe('/api/v1/organizations/org-1');
      expect(API_ENDPOINTS.ORGANIZATIONS.UPDATE('org-1')).toBe('/api/v1/organizations/org-1');
      expect(API_ENDPOINTS.ORGANIZATIONS.DELETE('org-1')).toBe('/api/v1/organizations/org-1');
      expect(API_ENDPOINTS.ORGANIZATIONS.MEMBERS('org-1')).toBe(
        '/api/v1/organizations/org-1/members'
      );
      expect(API_ENDPOINTS.ORGANIZATIONS.INVITE('org-1')).toBe(
        '/api/v1/organizations/org-1/members'
      );
    });
  });

  describe('HEALTH', () => {
    it('should have all health endpoints', () => {
      expect(API_ENDPOINTS.HEALTH.CHECK).toBe('/health');
      expect(API_ENDPOINTS.HEALTH.LIVE).toBe('/health/live');
      expect(API_ENDPOINTS.HEALTH.READY).toBe('/health/ready');
      expect(API_ENDPOINTS.HEALTH.METRICS).toBe('/metrics');
    });
  });

  describe('REALTIME', () => {
    it('should have realtime endpoints', () => {
      expect(API_ENDPOINTS.REALTIME.WS).toBe('/api/v1/ws');
      expect(API_ENDPOINTS.REALTIME.EVENTS).toBe('/api/v1/events');
    });
  });
});
