/**
 * Workflows API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Workflow, WorkflowStatus, WorkflowDependency, Job } from '@/lib/types';

export interface WorkflowJob {
  id?: string;
  queue: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority?: number;
  max_retries?: number;
  timeout_ms?: number;
  depends_on?: string[]; // References other job IDs within the workflow
  dependency_type?: 'success' | 'completion' | 'failure';
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  jobs: WorkflowJob[];
  metadata?: Record<string, string>;
}

export interface WorkflowWithDetails extends Workflow {
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
  };
  estimated_completion?: string;
}

export const workflowsAPI = {
  /**
   * GET /api/v1/workflows
   * List all workflows
   */
  list: (): Promise<Workflow[]> => {
    return apiClient.get<Workflow[]>(API_ENDPOINTS.WORKFLOWS.LIST);
  },

  /**
   * POST /api/v1/workflows
   * Create a new workflow
   */
  create: (data: CreateWorkflowRequest): Promise<Workflow> => {
    return apiClient.post<Workflow>(API_ENDPOINTS.WORKFLOWS.CREATE, data);
  },

  /**
   * GET /api/v1/workflows/{id}
   * Get workflow details
   */
  get: (id: string): Promise<WorkflowWithDetails> => {
    return apiClient.get<WorkflowWithDetails>(API_ENDPOINTS.WORKFLOWS.GET(id));
  },

  /**
   * POST /api/v1/workflows/{id}/cancel
   * Cancel a workflow and all pending jobs
   */
  cancel: (id: string): Promise<Workflow> => {
    return apiClient.post<Workflow>(API_ENDPOINTS.WORKFLOWS.CANCEL(id));
  },

  /**
   * POST /api/v1/workflows/{id}/retry
   * Retry failed jobs in a workflow
   */
  retry: (id: string): Promise<Workflow> => {
    return apiClient.post<Workflow>(API_ENDPOINTS.WORKFLOWS.RETRY(id));
  },
};

/**
 * Get workflow status color and label
 */
export function getWorkflowStatusInfo(status: WorkflowStatus): {
  color: string;
  bgColor: string;
  label: string;
} {
  switch (status) {
    case 'pending':
      return { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Pending' };
    case 'running':
      return { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Running' };
    case 'completed':
      return { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' };
    case 'failed':
      return { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Failed' };
    case 'cancelled':
      return { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Cancelled' };
    default:
      return { color: 'text-gray-600', bgColor: 'bg-gray-100', label: status };
  }
}

/**
 * Build a dependency graph from workflow jobs
 */
export function buildDependencyGraph(
  jobs: Job[],
  dependencies: WorkflowDependency[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  // Initialize all jobs
  jobs.forEach((job) => {
    graph.set(job.id, []);
  });

  // Add dependency edges
  dependencies.forEach((dep) => {
    const children = graph.get(dep.parent_job_id) || [];
    children.push(dep.child_job_id);
    graph.set(dep.parent_job_id, children);
  });

  return graph;
}

/**
 * Get root jobs (jobs with no dependencies)
 */
export function getRootJobs(jobs: Job[], dependencies: WorkflowDependency[]): Job[] {
  const childIds = new Set(dependencies.map((d) => d.child_job_id));
  return jobs.filter((job) => !childIds.has(job.id));
}

/**
 * Topologically sort jobs for display
 */
export function getJobLevels(jobs: Job[], dependencies: WorkflowDependency[]): Job[][] {
  const levels: Job[][] = [];
  const childToParents = new Map<string, Set<string>>();

  // Build reverse dependency map
  dependencies.forEach((dep) => {
    if (!childToParents.has(dep.child_job_id)) {
      childToParents.set(dep.child_job_id, new Set());
    }
    childToParents.get(dep.child_job_id)!.add(dep.parent_job_id);
  });

  // Find root jobs (level 0)
  const processed = new Set<string>();
  const rootJobs = jobs.filter((job) => !childToParents.has(job.id));

  if (rootJobs.length > 0) {
    levels.push(rootJobs);
    rootJobs.forEach((j) => processed.add(j.id));
  }

  // Process remaining levels
  while (processed.size < jobs.length) {
    const currentLevel: Job[] = [];

    jobs.forEach((job) => {
      if (processed.has(job.id)) return;

      const parents = childToParents.get(job.id);
      if (!parents || Array.from(parents).every((p) => processed.has(p))) {
        currentLevel.push(job);
      }
    });

    if (currentLevel.length === 0) break; // Prevent infinite loop

    levels.push(currentLevel);
    currentLevel.forEach((j) => processed.add(j.id));
  }

  return levels;
}
