/**
 * TanStack Query Configuration
 *
 * Centralized configuration for React Query
 */

import { QueryClient } from '@tanstack/react-query';
import { APIError } from '@/lib/api/client';

const MAX_QUERY_RETRIES = 3;

/**
 * Retry transient failures only. A 4xx is a definitive answer (bad id, forbidden,
 * rate limited, expired session); repeating it just delays the error and burns
 * rate limit.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof APIError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 30 seconds
      staleTime: 30 * 1000,

      // Cache time: 5 minutes
      gcTime: 5 * 60 * 1000,

      // Retry transient failures up to 3 times, never 4xx
      retry: shouldRetryQuery,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus
      refetchOnWindowFocus: true,

      // Refetch on mount
      refetchOnMount: 'always',
    },
    mutations: {
      // Never re-send a mutation: creates are not idempotent, and a 5xx/timeout can
      // arrive after the server already committed.
      retry: false,
    },
  },
});

/**
 * Query keys factory for type safety and consistency
 */
export const queryKeys = {
  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    overview: () => [...queryKeys.dashboard.all, 'overview'] as const,
  },

  // Jobs
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.jobs.lists(), filters] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    stats: () => [...queryKeys.jobs.all, 'stats'] as const,
    /** `version` (status and attempt) makes a state change a fresh read of the history. */
    history: (id: string, version?: string) =>
      [...queryKeys.jobs.all, 'history', id, ...(version ? [version] : [])] as const,
  },

  // Exact job counts behind list pagination. Deliberately NOT under `jobs`: realtime job
  // events invalidate `jobs.all` on every change, and these counts only need a slow refresh.
  jobTotals: {
    all: ['job-totals'] as const,
    count: (filters: { queue?: string; status?: string }) =>
      [...queryKeys.jobTotals.all, filters] as const,
  },

  // Queues
  queues: {
    all: ['queues'] as const,
    list: () => [...queryKeys.queues.all, 'list'] as const,
    detail: (name: string) => [...queryKeys.queues.all, 'detail', name] as const,
    stats: (name: string) => [...queryKeys.queues.all, 'stats', name] as const,
  },

  // Workers
  workers: {
    all: ['workers'] as const,
    list: () => [...queryKeys.workers.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workers.all, 'detail', id] as const,
  },

  // Workflows
  workflows: {
    all: ['workflows'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.workflows.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.workflows.all, 'detail', id] as const,
  },

  // Schedules
  schedules: {
    all: ['schedules'] as const,
    list: () => [...queryKeys.schedules.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.schedules.all, 'detail', id] as const,
    history: (id: string) => [...queryKeys.schedules.all, 'history', id] as const,
  },

  // API Keys
  apiKeys: {
    all: ['api-keys'] as const,
    list: () => [...queryKeys.apiKeys.all, 'list'] as const,
  },

  // Webhooks
  webhooks: {
    all: ['webhooks'] as const,
    list: () => [...queryKeys.webhooks.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.webhooks.all, 'detail', id] as const,
    deliveries: (id: string) => [...queryKeys.webhooks.all, 'deliveries', id] as const,
  },

  // Incoming webhook log (requests Spooled received), apart from the outgoing webhooks
  inboundWebhooks: {
    all: ['inbound-webhooks'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.inboundWebhooks.all, 'list', filters] as const,
  },

  // Usage & plan limits
  usage: {
    all: ['usage'] as const,
    current: () => [...queryKeys.usage.all, 'current'] as const,
  },

  // Organizations
  organizations: {
    all: ['organizations'] as const,
    list: () => [...queryKeys.organizations.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.organizations.all, 'detail', id] as const,
    members: (id: string) => [...queryKeys.organizations.all, 'members', id] as const,
  },
} as const;
