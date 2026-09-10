/**
 * Tests for Workflows API
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import {
  workflowsAPI,
  getWorkflowStatusInfo,
  buildDependencyGraph,
  getRootJobs,
  getJobLevels,
  toBackendWorkflowJob,
  withPayloadJobType,
} from './workflows';
import type { WorkflowDependency, Job } from '@/lib/types';

const API_BASE = 'https://api.spooled.cloud';

describe('toBackendWorkflowJob', () => {
  it('puts job_type into payload and converts timeout_ms to seconds', () => {
    const body = toBackendWorkflowJob({
      key: 'extract',
      queue_name: 'default',
      job_type: 'extract_data',
      payload: { source: 's3' },
      timeout_ms: 45000,
      depends_on: [],
    });

    expect(body).toEqual({
      key: 'extract',
      queue_name: 'default',
      payload: { source: 's3', job_type: 'extract_data' },
      depends_on: [],
      priority: undefined,
      max_retries: undefined,
      timeout_seconds: 45,
    });
    expect(body).not.toHaveProperty('job_type');
    expect(body).not.toHaveProperty('timeout_ms');
    expect(body).not.toHaveProperty('dependency_type');
  });

  it('does not spread a non-object payload when adding job_type', () => {
    expect(
      toBackendWorkflowJob({
        key: 'step',
        queue_name: 'default',
        job_type: 'extract_data',
        payload: 'plain-string',
      }).payload
    ).toBe('plain-string');
    expect(
      toBackendWorkflowJob({
        key: 'step',
        queue_name: 'default',
        job_type: 'extract_data',
        payload: [1, 2],
      }).payload
    ).toEqual([1, 2]);
  });

  it('does not overwrite an existing payload.job_type', () => {
    const body = toBackendWorkflowJob({
      key: 'step',
      queue_name: 'default',
      job_type: 'ignored',
      payload: { job_type: 'keep_me' },
    });
    expect(body.payload).toEqual({ job_type: 'keep_me' });
  });
});

describe('workflowsAPI', () => {
  describe('list', () => {
    it('should fetch workflows list', async () => {
      const result = await workflowsAPI.list();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('posts the backend contract and returns workflow_id, not id', async () => {
      let posted: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/api/v1/workflows`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            workflow_id: 'wf-real',
            job_ids: [{ key: 'extract', job_id: 'job-1' }],
            status: 'pending',
          });
        })
      );

      const created = await workflowsAPI.create({
        name: 'Pipeline',
        jobs: [
          {
            key: 'extract',
            queue_name: 'default',
            job_type: 'extract_data',
            payload: {},
            timeout_ms: 30000,
            depends_on: [],
            dependency_type: 'success',
          },
        ],
      });

      expect(created.workflow_id).toBe('wf-real');
      expect(created).not.toHaveProperty('id');
      expect(posted).toMatchObject({
        name: 'Pipeline',
        jobs: [
          {
            key: 'extract',
            queue_name: 'default',
            payload: { job_type: 'extract_data' },
            timeout_seconds: 30,
          },
        ],
      });
      // `posted` is only ever assigned inside the MSW handler, so control-flow
      // analysis still has it narrowed to `null` here.
      const postedBody = posted as unknown as Record<string, unknown>;
      const postedJobs = postedBody.jobs as Array<Record<string, unknown>>;
      expect(postedJobs[0]).not.toHaveProperty('job_type');
      expect(postedJobs[0]).not.toHaveProperty('timeout_ms');
      expect(postedJobs[0]).not.toHaveProperty('dependency_type');
    });
  });

  describe('get', () => {
    it('should fetch a single workflow by ID', async () => {
      const workflow = await workflowsAPI.get('workflow-1');
      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('workflow-1');
      expect(workflow.progress).toBeDefined();
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(workflowsAPI.get('non-existent')).rejects.toThrow();
    });

    it('maps job_type from payload when GET hardcodes "job"', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/workflows/wf-payload-type`, () => {
          return HttpResponse.json({
            id: 'wf-payload-type',
            organization_id: 'org-1',
            name: 'ETL',
            status: 'running',
            jobs: [
              {
                id: 'job-1',
                organization_id: 'org-1',
                queue: 'etl',
                job_type: 'job',
                payload: { source: 's3', job_type: 'extract_data' },
                status: 'completed',
                priority: 0,
                attempt: 0,
                max_retries: 3,
                backoff_type: 'exponential',
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
            dependencies: [],
            progress: { total: 1, completed: 1, failed: 0, pending: 0, processing: 0 },
            created_at: '2024-01-01T00:00:00Z',
          });
        })
      );

      const workflow = await workflowsAPI.get('wf-payload-type');
      expect(workflow.jobs[0].job_type).toBe('extract_data');
    });
  });
});

describe('withPayloadJobType', () => {
  it('prefers payload.job_type over the hardcoded GET value', () => {
    expect(
      withPayloadJobType({
        job_type: 'job',
        payload: { job_type: 'transform_data' },
      }).job_type
    ).toBe('transform_data');
  });

  it('keeps the existing job_type when payload has none', () => {
    expect(withPayloadJobType({ job_type: 'send_email', payload: { to: 'a' } }).job_type).toBe(
      'send_email'
    );
  });
});

describe('getWorkflowStatusInfo', () => {
  it('should return correct info for pending status', () => {
    const info = getWorkflowStatusInfo('pending');
    expect(info.color).toBe('text-gray-600');
    expect(info.bgColor).toBe('bg-gray-100');
    expect(info.label).toBe('Pending');
  });

  it('should return correct info for running status', () => {
    const info = getWorkflowStatusInfo('running');
    expect(info.color).toBe('text-blue-600');
    expect(info.bgColor).toBe('bg-blue-100');
    expect(info.label).toBe('Running');
  });

  it('should return correct info for completed status', () => {
    const info = getWorkflowStatusInfo('completed');
    expect(info.color).toBe('text-green-600');
    expect(info.bgColor).toBe('bg-green-100');
    expect(info.label).toBe('Completed');
  });

  it('should return correct info for failed status', () => {
    const info = getWorkflowStatusInfo('failed');
    expect(info.color).toBe('text-red-600');
    expect(info.bgColor).toBe('bg-red-100');
    expect(info.label).toBe('Failed');
  });

  it('should return correct info for cancelled status', () => {
    const info = getWorkflowStatusInfo('cancelled');
    expect(info.color).toBe('text-orange-600');
    expect(info.bgColor).toBe('bg-orange-100');
    expect(info.label).toBe('Cancelled');
  });

  it('should return default info for unknown status', () => {
    const info = getWorkflowStatusInfo('unknown' as never);
    expect(info.color).toBe('text-gray-600');
    expect(info.bgColor).toBe('bg-gray-100');
    expect(info.label).toBe('unknown');
  });
});

describe('buildDependencyGraph', () => {
  it('should build graph with no dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job];
    const dependencies: WorkflowDependency[] = [];

    const graph = buildDependencyGraph(jobs, dependencies);

    expect(graph.size).toBe(2);
    expect(graph.get('job-1')).toEqual([]);
    expect(graph.get('job-2')).toEqual([]);
  });

  it('should build graph with dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job, { id: 'job-3' } as Job];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-2' } as WorkflowDependency,
      { parent_job_id: 'job-1', child_job_id: 'job-3' } as WorkflowDependency,
    ];

    const graph = buildDependencyGraph(jobs, dependencies);

    expect(graph.size).toBe(3);
    expect(graph.get('job-1')).toEqual(['job-2', 'job-3']);
    expect(graph.get('job-2')).toEqual([]);
    expect(graph.get('job-3')).toEqual([]);
  });

  it('should handle chain dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job, { id: 'job-3' } as Job];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-2' } as WorkflowDependency,
      { parent_job_id: 'job-2', child_job_id: 'job-3' } as WorkflowDependency,
    ];

    const graph = buildDependencyGraph(jobs, dependencies);

    expect(graph.get('job-1')).toEqual(['job-2']);
    expect(graph.get('job-2')).toEqual(['job-3']);
    expect(graph.get('job-3')).toEqual([]);
  });
});

describe('getRootJobs', () => {
  it('should return all jobs when no dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job];
    const dependencies: WorkflowDependency[] = [];

    const roots = getRootJobs(jobs, dependencies);

    expect(roots.length).toBe(2);
    expect(roots.map((j) => j.id)).toContain('job-1');
    expect(roots.map((j) => j.id)).toContain('job-2');
  });

  it('should return only root jobs with dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job, { id: 'job-3' } as Job];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-2' } as WorkflowDependency,
      { parent_job_id: 'job-1', child_job_id: 'job-3' } as WorkflowDependency,
    ];

    const roots = getRootJobs(jobs, dependencies);

    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe('job-1');
  });

  it('should handle multiple roots', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job, { id: 'job-3' } as Job];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-3' } as WorkflowDependency,
      { parent_job_id: 'job-2', child_job_id: 'job-3' } as WorkflowDependency,
    ];

    const roots = getRootJobs(jobs, dependencies);

    expect(roots.length).toBe(2);
    expect(roots.map((j) => j.id)).toContain('job-1');
    expect(roots.map((j) => j.id)).toContain('job-2');
  });
});

describe('getJobLevels', () => {
  it('should return single level for no dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job];
    const dependencies: WorkflowDependency[] = [];

    const levels = getJobLevels(jobs, dependencies);

    expect(levels.length).toBe(1);
    expect(levels[0].length).toBe(2);
  });

  it('should return multiple levels for chain dependencies', () => {
    const jobs: Job[] = [{ id: 'job-1' } as Job, { id: 'job-2' } as Job, { id: 'job-3' } as Job];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-2' } as WorkflowDependency,
      { parent_job_id: 'job-2', child_job_id: 'job-3' } as WorkflowDependency,
    ];

    const levels = getJobLevels(jobs, dependencies);

    expect(levels.length).toBe(3);
    expect(levels[0].length).toBe(1);
    expect(levels[0][0].id).toBe('job-1');
    expect(levels[1].length).toBe(1);
    expect(levels[1][0].id).toBe('job-2');
    expect(levels[2].length).toBe(1);
    expect(levels[2][0].id).toBe('job-3');
  });

  it('should handle diamond dependencies', () => {
    const jobs: Job[] = [
      { id: 'job-1' } as Job,
      { id: 'job-2' } as Job,
      { id: 'job-3' } as Job,
      { id: 'job-4' } as Job,
    ];
    const dependencies: WorkflowDependency[] = [
      { parent_job_id: 'job-1', child_job_id: 'job-2' } as WorkflowDependency,
      { parent_job_id: 'job-1', child_job_id: 'job-3' } as WorkflowDependency,
      { parent_job_id: 'job-2', child_job_id: 'job-4' } as WorkflowDependency,
      { parent_job_id: 'job-3', child_job_id: 'job-4' } as WorkflowDependency,
    ];

    const levels = getJobLevels(jobs, dependencies);

    expect(levels.length).toBe(3);
    expect(levels[0][0].id).toBe('job-1');
    expect(levels[1].map((j) => j.id).sort()).toEqual(['job-2', 'job-3']);
    expect(levels[2][0].id).toBe('job-4');
  });

  it('should handle empty jobs array', () => {
    const jobs: Job[] = [];
    const dependencies: WorkflowDependency[] = [];

    const levels = getJobLevels(jobs, dependencies);

    expect(levels.length).toBe(0);
  });
});
