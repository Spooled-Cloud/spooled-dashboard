/**
 * Core TypeScript types for Spooled Dashboard
 */

// ============================================================================
// User & Authentication Types
// ============================================================================

export type UserRole = 'super_admin' | 'org_admin' | 'operator' | 'developer' | 'viewer';

export type Permission =
  | 'jobs:read'
  | 'jobs:write'
  | 'jobs:delete'
  | 'queues:read'
  | 'queues:write'
  | 'queues:admin'
  | 'workers:read'
  | 'workers:write'
  | 'api-keys:read'
  | 'api-keys:write'
  | 'schedules:read'
  | 'schedules:write'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'organization:read'
  | 'organization:admin'
  | 'users:read'
  | 'users:admin'
  | 'system:admin';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: UserRole;
  permissions: Permission[];
  organization_id: string;
  organization_name: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  status: 'active' | 'suspended' | 'pending_verification';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobStatus =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'deadletter';

export type BackoffType = 'exponential' | 'linear' | 'fixed';

export interface Job {
  id: string;
  organization_id: string;
  queue: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  attempt: number;
  max_retries: number;
  backoff_type: BackoffType;
  timeout_ms?: number;
  created_at: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  next_retry_at?: string;
  result?: Record<string, unknown>;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, string>;
  workflow_id?: string;
  parent_job_id?: string;
}

export interface CreateJobRequest {
  queue: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority?: number;
  max_retries?: number;
  backoff_type?: BackoffType;
  timeout_ms?: number;
  scheduled_at?: string;
  metadata?: Record<string, string>;
  idempotency_key?: string;
  parent_job_id?: string;
}

export interface JobStatistics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  deadletter: number;
  by_queue: Record<string, number>;
  by_type: Record<string, number>;
  by_hour: { hour: string; count: number }[];
}

// ============================================================================
// Queue Types
// ============================================================================

export interface Queue {
  name: string;
  organization_id: string;
  description?: string;
  concurrency: number;
  max_retries: number;
  retry_delay_ms: number;
  backoff_multiplier: number;
  max_retry_delay_ms: number;
  job_timeout_ms: number;
  paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueStats {
  name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadletter: number;
  active_workers: number;
  jobs_per_second: number;
  avg_processing_time_ms: number;
}

export interface CreateQueueRequest {
  name: string;
  description?: string;
  concurrency?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  backoff_multiplier?: number;
  max_retry_delay_ms?: number;
  job_timeout_ms?: number;
}

// ============================================================================
// Worker Types
// ============================================================================

export type WorkerStatus = 'active' | 'idle' | 'offline' | 'draining';

export interface Worker {
  id: string;
  organization_id: string;
  hostname: string;
  queues: string[];
  concurrency: number;
  current_jobs: number;
  status: WorkerStatus;
  last_heartbeat: string;
  started_at: string;
  jobs_processed: number;
  jobs_failed: number;
  metadata?: Record<string, string>;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Workflow {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  jobs: Job[];
  dependencies: WorkflowDependency[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, string>;
}

export interface WorkflowDependency {
  parent_job_id: string;
  child_job_id: string;
  dependency_type: 'success' | 'completion' | 'failure';
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface Schedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  cron_expression: string;
  timezone: string;
  queue: string;
  job_type: string;
  payload: Record<string, unknown>;
  enabled: boolean;
  last_run?: string;
  last_run_status?: 'success' | 'failed';
  last_job_id?: string;
  next_run?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// Organization Types
// ============================================================================

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  owner_id: string;
  plan: OrganizationPlan;
  status: 'active' | 'suspended' | 'pending';
  member_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardData {
  system_info: {
    version: string;
    uptime_seconds: number;
    rust_version: string;
  };
  job_statistics: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    deadletter: number;
    success_rate: number;
    avg_processing_time_ms: number;
  };
  queue_summaries: Array<{
    name: string;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    paused: boolean;
  }>;
  worker_status: {
    total: number;
    active: number;
    idle: number;
    offline: number;
  };
  recent_activity: ActivityEvent[];
  processing_rate: Array<{
    timestamp: string;
    jobs_per_second: number;
  }>;
}

export interface ActivityEvent {
  type: string;
  job_id?: string;
  queue?: string;
  timestamp: string;
  [key: string]: unknown;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  channel?: string;
  payload?: unknown;
}

export interface WebSocketEvent {
  type: string;
  channel: string;
  payload: unknown;
  timestamp: string;
}

export type WebSocketEventType =
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.cancelled'
  | 'queue.paused'
  | 'queue.resumed'
  | 'queue.stats'
  | 'worker.registered'
  | 'worker.heartbeat'
  | 'worker.deregistered'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'schedule.triggered';
