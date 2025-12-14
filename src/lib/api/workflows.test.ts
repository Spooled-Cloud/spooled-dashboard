/**
 * Tests for Workflows API
 */

import { describe, it, expect } from 'vitest';
import {
  workflowsAPI,
  getWorkflowStatusInfo,
  buildDependencyGraph,
  getRootJobs,
  getJobLevels,
} from './workflows';
import type { WorkflowDependency, Job } from '@/lib/types';

describe('workflowsAPI', () => {
  describe('list', () => {
    it('should fetch workflows list', async () => {
      const result = await workflowsAPI.list();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
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
