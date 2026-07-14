import { describe, expect, it } from 'vitest';
import { createWorkflowSchema } from './create-workflow-schema';

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
          depends_on: ['extract'],
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
          depends_on: ['second'],
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
});
