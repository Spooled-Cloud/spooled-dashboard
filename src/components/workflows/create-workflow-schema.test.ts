import { describe, expect, it } from 'vitest';
import { createWorkflowSchema, toWorkflowRequestJobs } from './create-workflow-schema';

describe('createWorkflowSchema', () => {
  it('accepts a valid workflow with dependencies', () => {
    const result = createWorkflowSchema.safeParse({
      name: 'Pipeline',
      jobs: [
        {
          tempId: '1',
          key: 'extract',
          queue_name: 'default',
          job_type: 'extract_data',
          depends_on: [],
        },
        {
          tempId: '2',
          key: 'transform',
          queue_name: 'default',
          job_type: 'transform_data',
          depends_on: ['1'],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects duplicate job keys', () => {
    const result = createWorkflowSchema.safeParse({
      name: 'Pipeline',
      jobs: [
        {
          tempId: '1',
          key: 'step',
          queue_name: 'default',
          job_type: 'a',
          depends_on: [],
        },
        {
          tempId: '2',
          key: 'step',
          queue_name: 'default',
          job_type: 'b',
          depends_on: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects dependencies on later jobs', () => {
    const result = createWorkflowSchema.safeParse({
      name: 'Pipeline',
      jobs: [
        {
          tempId: '1',
          key: 'first',
          queue_name: 'default',
          job_type: 'a',
          depends_on: ['2'],
        },
        {
          tempId: '2',
          key: 'second',
          queue_name: 'default',
          job_type: 'b',
          depends_on: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a dependency on a job that is not in the form', () => {
    const result = createWorkflowSchema.safeParse({
      name: 'Pipeline',
      jobs: [
        { tempId: '1', key: 'a', queue_name: 'default', job_type: 'a', depends_on: [] },
        { tempId: '2', key: 'b', queue_name: 'default', job_type: 'b', depends_on: ['gone'] },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('toWorkflowRequestJobs', () => {
  it('sends the current key of each dependency, whatever it was when it was picked', () => {
    const jobs = toWorkflowRequestJobs([
      { tempId: '1', key: 'extract', queue_name: 'default', job_type: 'a', depends_on: [] },
      { tempId: 'job-1', key: 'load', queue_name: 'default', job_type: 'b', depends_on: ['1'] },
    ]);

    expect(jobs.map((job) => job.depends_on)).toEqual([[], ['extract']]);
    expect(jobs[1]).not.toHaveProperty('tempId');
  });
});
