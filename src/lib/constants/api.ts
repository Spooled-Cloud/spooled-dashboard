/**
 * API Constants and Configuration
 *
 * API_BASE_URL and WS_BASE_URL are loaded at runtime from /api/config
 * to support per-deployment configuration without rebuilding the image.
 */

import { getApiUrl, getWsUrl } from '@/lib/config/runtime';

// Re-export the getter functions for dynamic access
export { getApiUrl, getWsUrl };

// Legacy constants - these evaluate at import time and may use defaults
// Prefer using getApiUrl()/getWsUrl() directly for dynamic values
export const API_BASE_URL = 'https://api.spooled.cloud'; // Default fallback
export const WS_BASE_URL = 'wss://api.spooled.cloud'; // Default fallback

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    ME: '/api/v1/auth/me',
    VALIDATE: '/api/v1/auth/validate',
    EMAIL_START: '/api/v1/auth/email/start',
    EMAIL_VERIFY: '/api/v1/auth/email/verify',
  },

  // Dashboard
  DASHBOARD: '/api/v1/dashboard',

  // Jobs
  JOBS: {
    LIST: '/api/v1/jobs',
    CREATE: '/api/v1/jobs',
    GET: (id: string) => `/api/v1/jobs/${id}`,
    DELETE: (id: string) => `/api/v1/jobs/${id}`,
    RETRY: (id: string) => `/api/v1/jobs/${id}/retry`,
    CANCEL: (id: string) => `/api/v1/jobs/${id}/cancel`,
    PRIORITY: (id: string) => `/api/v1/jobs/${id}/priority`,
    STATS: '/api/v1/jobs/stats',
    STATUS: '/api/v1/jobs/status',
    BULK: '/api/v1/jobs/bulk',
    DLQ: '/api/v1/jobs/dlq',
    DLQ_RETRY: '/api/v1/jobs/dlq/retry',
    DLQ_PURGE: '/api/v1/jobs/dlq/purge',
  },

  // Queues
  QUEUES: {
    LIST: '/api/v1/queues',
    CREATE: '/api/v1/queues',
    GET: (name: string) => `/api/v1/queues/${name}`,
    UPDATE: (name: string) => `/api/v1/queues/${name}/config`,
    DELETE: (name: string) => `/api/v1/queues/${name}`,
    STATS: (name: string) => `/api/v1/queues/${name}/stats`,
    PAUSE: (name: string) => `/api/v1/queues/${name}/pause`,
    RESUME: (name: string) => `/api/v1/queues/${name}/resume`,
    PURGE: (name: string) => `/api/v1/queues/${name}/purge`,
  },

  // Workers
  WORKERS: {
    LIST: '/api/v1/workers',
    REGISTER: '/api/v1/workers',
    GET: (id: string) => `/api/v1/workers/${id}`,
    HEARTBEAT: (id: string) => `/api/v1/workers/${id}/heartbeat`,
    DEREGISTER: (id: string) => `/api/v1/workers/${id}`,
  },

  // Workflows
  WORKFLOWS: {
    LIST: '/api/v1/workflows',
    CREATE: '/api/v1/workflows',
    GET: (id: string) => `/api/v1/workflows/${id}`,
    CANCEL: (id: string) => `/api/v1/workflows/${id}/cancel`,
    RETRY: (id: string) => `/api/v1/workflows/${id}/retry`,
  },

  // Schedules
  SCHEDULES: {
    LIST: '/api/v1/schedules',
    CREATE: '/api/v1/schedules',
    GET: (id: string) => `/api/v1/schedules/${id}`,
    UPDATE: (id: string) => `/api/v1/schedules/${id}`,
    DELETE: (id: string) => `/api/v1/schedules/${id}`,
    TRIGGER: (id: string) => `/api/v1/schedules/${id}/trigger`,
    PAUSE: (id: string) => `/api/v1/schedules/${id}/pause`,
    RESUME: (id: string) => `/api/v1/schedules/${id}/resume`,
    HISTORY: (id: string) => `/api/v1/schedules/${id}/history`,
  },

  // API Keys
  API_KEYS: {
    LIST: '/api/v1/api-keys',
    CREATE: '/api/v1/api-keys',
    GET: (id: string) => `/api/v1/api-keys/${id}`,
    UPDATE: (id: string) => `/api/v1/api-keys/${id}`,
    REVOKE: (id: string) => `/api/v1/api-keys/${id}`,
  },

  // Outgoing Webhooks (notification configuration)
  WEBHOOKS: {
    LIST: '/api/v1/outgoing-webhooks',
    CREATE: '/api/v1/outgoing-webhooks',
    GET: (id: string) => `/api/v1/outgoing-webhooks/${id}`,
    UPDATE: (id: string) => `/api/v1/outgoing-webhooks/${id}`,
    DELETE: (id: string) => `/api/v1/outgoing-webhooks/${id}`,
    TEST: (id: string) => `/api/v1/outgoing-webhooks/${id}/test`,
    DELIVERIES: (id: string) => `/api/v1/outgoing-webhooks/${id}/deliveries`,
  },

  // Organizations
  ORGANIZATIONS: {
    LIST: '/api/v1/organizations',
    CREATE: '/api/v1/organizations',
    USAGE: '/api/v1/organizations/usage',
    GET: (id: string) => `/api/v1/organizations/${id}`,
    UPDATE: (id: string) => `/api/v1/organizations/${id}`,
    DELETE: (id: string) => `/api/v1/organizations/${id}`,
    MEMBERS: (id: string) => `/api/v1/organizations/${id}/members`,
    INVITE: (id: string) => `/api/v1/organizations/${id}/members`,
  },

  // Billing
  BILLING: {
    STATUS: '/api/v1/billing/status',
    PORTAL: '/api/v1/billing/portal',
  },

  // Health
  HEALTH: {
    CHECK: '/health',
    LIVE: '/health/live',
    READY: '/health/ready',
    METRICS: '/metrics',
  },

  // Real-time
  REALTIME: {
    WS: '/api/v1/ws',
    EVENTS: '/api/v1/events',
  },
} as const;

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;
