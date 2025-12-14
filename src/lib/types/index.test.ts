/**
 * Tests for Core TypeScript Types
 *
 * These tests validate type structures and ensure type safety.
 */

import { describe, it, expect } from 'vitest';
import type {
  UserRole,
  Permission,
  User,
  LoginRequest,
  LoginResponse,
  JobStatus,
  BackoffType,
  Job,
  CreateJobRequest,
  JobStatistics,
  Queue,
  QueueStats,
  WorkerStatus,
  Worker,
  WorkflowStatus,
  WorkflowDependency,
  Schedule,
  PaginatedResponse,
  APIError,
  WebSocketMessage,
  WebSocketEvent,
  WebSocketEventType,
} from './index';

describe('User & Authentication Types', () => {
  describe('UserRole', () => {
    it('should define all expected roles', () => {
      const roles: UserRole[] = ['super_admin', 'org_admin', 'operator', 'developer', 'viewer'];
      expect(roles.length).toBe(5);
    });
  });

  describe('Permission', () => {
    it('should define common permissions', () => {
      const permissions: Permission[] = [
        'jobs:read',
        'jobs:write',
        'queues:read',
        'organization:admin',
      ];
      expect(permissions.length).toBe(4);
    });
  });

  describe('User', () => {
    it('should have all required properties', () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
        permissions: ['jobs:read', 'jobs:write'],
        organization_id: 'org-1',
        organization_name: 'Test Org',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        email_verified: true,
        two_factor_enabled: false,
        status: 'active',
      };

      expect(user.id).toBe('user-1');
      expect(user.role).toBe('developer');
      expect(user.status).toBe('active');
    });

    it('should allow optional properties', () => {
      const user: User = {
        id: 'user-2',
        email: 'test2@example.com',
        name: 'Test User 2',
        avatar_url: 'https://example.com/avatar.png',
        role: 'viewer',
        permissions: [],
        organization_id: 'org-1',
        organization_name: 'Test Org',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-02T00:00:00Z',
        email_verified: false,
        two_factor_enabled: true,
        status: 'pending_verification',
      };

      expect(user.avatar_url).toBe('https://example.com/avatar.png');
      expect(user.last_login_at).toBeDefined();
    });
  });

  describe('LoginRequest', () => {
    it('should require api_key', () => {
      const request: LoginRequest = {
        api_key: 'sk_test_abc123',
      };

      expect(request.api_key).toBe('sk_test_abc123');
    });
  });

  describe('LoginResponse', () => {
    it('should contain all token fields', () => {
      const response: LoginResponse = {
        access_token: 'eyJ...',
        refresh_token: 'eyJ...',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 2592000,
      };

      expect(response.token_type).toBe('Bearer');
      expect(response.expires_in).toBe(3600);
    });
  });
});

describe('Job Types', () => {
  describe('JobStatus', () => {
    it('should define all job statuses', () => {
      const statuses: JobStatus[] = [
        'pending',
        'scheduled',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'deadletter',
      ];
      expect(statuses.length).toBe(7);
    });
  });

  describe('BackoffType', () => {
    it('should define backoff strategies', () => {
      const backoffTypes: BackoffType[] = ['exponential', 'linear', 'fixed'];
      expect(backoffTypes.length).toBe(3);
    });
  });

  describe('Job', () => {
    it('should have all required properties', () => {
      const job: Job = {
        id: 'job-1',
        organization_id: 'org-1',
        queue: 'default',
        job_type: 'send_email',
        payload: { to: 'user@example.com' },
        status: 'completed',
        priority: 0,
        attempt: 1,
        max_retries: 3,
        backoff_type: 'exponential',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(job.id).toBe('job-1');
      expect(job.status).toBe('completed');
    });

    it('should support error object', () => {
      const job: Job = {
        id: 'job-2',
        organization_id: 'org-1',
        queue: 'default',
        job_type: 'process_image',
        payload: {},
        status: 'failed',
        priority: 0,
        attempt: 3,
        max_retries: 3,
        backoff_type: 'exponential',
        created_at: '2024-01-01T00:00:00Z',
        failed_at: '2024-01-01T00:01:00Z',
        error: {
          type: 'TimeoutError',
          message: 'Job timed out',
          stack: 'Error: Job timed out\n at ...',
        },
      };

      expect(job.error?.type).toBe('TimeoutError');
    });
  });

  describe('CreateJobRequest', () => {
    it('should require minimal fields', () => {
      const request: CreateJobRequest = {
        queue: 'emails',
        job_type: 'send_notification',
        payload: { user_id: '123' },
      };

      expect(request.queue).toBe('emails');
      expect(request.job_type).toBe('send_notification');
    });

    it('should support all optional fields', () => {
      const request: CreateJobRequest = {
        queue: 'emails',
        job_type: 'send_notification',
        payload: { user_id: '123' },
        priority: 10,
        max_retries: 5,
        backoff_type: 'linear',
        timeout_ms: 30000,
        scheduled_at: '2024-01-02T00:00:00Z',
        metadata: { source: 'api' },
        idempotency_key: 'unique-key-123',
        parent_job_id: 'job-parent',
      };

      expect(request.priority).toBe(10);
      expect(request.idempotency_key).toBe('unique-key-123');
    });
  });

  describe('JobStatistics', () => {
    it('should have all count fields', () => {
      const stats: JobStatistics = {
        total: 1000,
        pending: 50,
        processing: 10,
        completed: 900,
        failed: 30,
        cancelled: 5,
        deadletter: 5,
        by_queue: { default: 800, emails: 200 },
        by_type: { send_email: 500, process_image: 500 },
        by_hour: [{ hour: '2024-01-01T00:00:00Z', count: 100 }],
      };

      expect(stats.total).toBe(1000);
      expect(stats.by_queue.default).toBe(800);
    });
  });
});

describe('Queue Types', () => {
  describe('Queue', () => {
    it('should have all required properties', () => {
      const queue: Queue = {
        name: 'default',
        organization_id: 'org-1',
        concurrency: 10,
        max_retries: 3,
        retry_delay_ms: 1000,
        backoff_multiplier: 2,
        max_retry_delay_ms: 60000,
        job_timeout_ms: 30000,
        paused: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(queue.name).toBe('default');
      expect(queue.paused).toBe(false);
    });
  });

  describe('QueueStats', () => {
    it('should have performance metrics', () => {
      const stats: QueueStats = {
        name: 'default',
        pending: 10,
        processing: 5,
        completed: 100,
        failed: 2,
        deadletter: 1,
        active_workers: 3,
        jobs_per_second: 5.5,
        avg_processing_time_ms: 1200,
      };

      expect(stats.jobs_per_second).toBe(5.5);
      expect(stats.avg_processing_time_ms).toBe(1200);
    });
  });
});

describe('Worker Types', () => {
  describe('WorkerStatus', () => {
    it('should define all worker statuses', () => {
      const statuses: WorkerStatus[] = ['active', 'idle', 'offline', 'draining'];
      expect(statuses.length).toBe(4);
    });
  });

  describe('Worker', () => {
    it('should have all required properties', () => {
      const worker: Worker = {
        id: 'worker-1',
        organization_id: 'org-1',
        hostname: 'worker-node-1',
        queues: ['default', 'emails'],
        concurrency: 10,
        current_jobs: 3,
        status: 'active',
        last_heartbeat: '2024-01-01T12:00:00Z',
        started_at: '2024-01-01T00:00:00Z',
        jobs_processed: 150,
        jobs_failed: 5,
      };

      expect(worker.id).toBe('worker-1');
      expect(worker.queues).toContain('default');
    });
  });
});

describe('Workflow Types', () => {
  describe('WorkflowStatus', () => {
    it('should define all workflow statuses', () => {
      const statuses: WorkflowStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled'];
      expect(statuses.length).toBe(5);
    });
  });

  describe('WorkflowDependency', () => {
    it('should define dependency types', () => {
      const dependency: WorkflowDependency = {
        parent_job_id: 'job-1',
        child_job_id: 'job-2',
        dependency_type: 'success',
      };

      expect(dependency.dependency_type).toBe('success');
    });

    it('should support all dependency types', () => {
      const types: Array<WorkflowDependency['dependency_type']> = [
        'success',
        'completion',
        'failure',
      ];
      expect(types.length).toBe(3);
    });
  });
});

describe('Schedule Types', () => {
  describe('Schedule', () => {
    it('should have cron configuration', () => {
      const schedule: Schedule = {
        id: 'schedule-1',
        organization_id: 'org-1',
        name: 'Daily Cleanup',
        cron_expression: '0 0 * * *',
        timezone: 'UTC',
        queue: 'default',
        job_type: 'cleanup',
        payload: {},
        enabled: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(schedule.cron_expression).toBe('0 0 * * *');
      expect(schedule.timezone).toBe('UTC');
    });

    it('should support run history fields', () => {
      const schedule: Schedule = {
        id: 'schedule-2',
        organization_id: 'org-1',
        name: 'Hourly Report',
        cron_expression: '0 * * * *',
        timezone: 'America/New_York',
        queue: 'reports',
        job_type: 'generate_report',
        payload: { type: 'summary' },
        enabled: true,
        last_run: '2024-01-01T11:00:00Z',
        last_run_status: 'success',
        last_job_id: 'job-123',
        next_run: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      expect(schedule.last_run_status).toBe('success');
      expect(schedule.next_run).toBeDefined();
    });
  });
});

describe('API Response Types', () => {
  describe('PaginatedResponse', () => {
    it('should have pagination metadata', () => {
      const response: PaginatedResponse<Job> = {
        data: [],
        total: 100,
        page: 1,
        per_page: 20,
        total_pages: 5,
      };

      expect(response.total_pages).toBe(5);
      expect(response.per_page).toBe(20);
    });
  });

  describe('APIError', () => {
    it('should have error information', () => {
      const error: APIError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: { field: 'email', reason: 'Invalid format' },
      };

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details?.field).toBe('email');
    });
  });
});

describe('WebSocket Types', () => {
  describe('WebSocketMessage', () => {
    it('should support subscribe message', () => {
      const message: WebSocketMessage = {
        type: 'subscribe',
        channel: 'jobs',
      };

      expect(message.type).toBe('subscribe');
      expect(message.channel).toBe('jobs');
    });

    it('should support ping message', () => {
      const message: WebSocketMessage = {
        type: 'ping',
      };

      expect(message.type).toBe('ping');
    });
  });

  describe('WebSocketEvent', () => {
    it('should have event structure', () => {
      const event: WebSocketEvent = {
        type: 'job.completed',
        channel: 'jobs',
        payload: { job_id: 'job-1' },
        timestamp: '2024-01-01T12:00:00Z',
      };

      expect(event.type).toBe('job.completed');
      expect(event.channel).toBe('jobs');
    });
  });

  describe('WebSocketEventType', () => {
    it('should define all event types', () => {
      const eventTypes: WebSocketEventType[] = [
        'job.created',
        'job.started',
        'job.completed',
        'job.failed',
        'job.cancelled',
        'queue.paused',
        'queue.resumed',
        'queue.stats',
        'worker.registered',
        'worker.heartbeat',
        'worker.deregistered',
        'workflow.started',
        'workflow.completed',
        'workflow.failed',
        'schedule.triggered',
      ];

      expect(eventTypes.length).toBe(15);
    });
  });
});
