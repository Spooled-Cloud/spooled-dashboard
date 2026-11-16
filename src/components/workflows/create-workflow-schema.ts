import { z } from 'zod';

export const workflowJobSchema = z.object({
  /** Stable id of the job inside the form; never sent. */
  tempId: z.string(),
  key: z
    .string()
    .trim()
    .min(1, 'Job key is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Key may only contain letters, numbers, underscores, and hyphens'),
  queue_name: z.string().min(1, 'Queue is required'),
  job_type: z.string().trim().min(1, 'Job type is required'),
  /**
   * The `tempId`s of the jobs this one depends on, not their keys: a key can be renamed while
   * the form is open, and a dependency stored as the old key no longer matched any job.
   * `toWorkflowRequestJobs` turns them into keys for the request.
   */
  depends_on: z.array(z.string()),
});

export const createWorkflowSchema = z
  .object({
    name: z.string().trim().min(1, 'Workflow name is required'),
    description: z.string().optional(),
    jobs: z.array(workflowJobSchema).min(1, 'At least one job is required'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();

    data.jobs.forEach((job, index) => {
      if (seen.has(job.key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Job keys must be unique',
          path: ['jobs', index, 'key'],
        });
      } else {
        seen.add(job.key);
      }

      const dependency = job.depends_on[0];
      if (!dependency) return;

      const depIndex = data.jobs.findIndex((candidate) => candidate.tempId === dependency);
      if (depIndex === -1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Dependency must reference an earlier job',
          path: ['jobs', index, 'depends_on'],
        });
        return;
      }

      if (depIndex >= index) {
        ctx.addIssue({
          code: 'custom',
          message: 'Dependencies can only reference earlier jobs',
          path: ['jobs', index, 'depends_on'],
        });
      }
    });
  });

export type CreateWorkflowFormValues = z.infer<typeof createWorkflowSchema>;

export function createDefaultJob(
  index: number,
  previousTempId?: string,
  tempId = String(index + 1)
): CreateWorkflowFormValues['jobs'][number] {
  const key = String(index + 1);
  return {
    tempId,
    key,
    queue_name: '',
    job_type: '',
    depends_on: previousTempId ? [previousTempId] : [],
  };
}

/** Jobs of a valid form with `depends_on` turned from form ids into the jobs' current keys. */
export function toWorkflowRequestJobs(
  jobs: CreateWorkflowFormValues['jobs']
): Array<{ key: string; queue_name: string; job_type: string; depends_on: string[] }> {
  const keyByTempId = new Map(jobs.map((job) => [job.tempId, job.key]));
  return jobs.map((job) => ({
    key: job.key,
    queue_name: job.queue_name,
    job_type: job.job_type,
    depends_on: job.depends_on.flatMap((tempId) => {
      const key = keyByTempId.get(tempId);
      return key === undefined ? [] : [key];
    }),
  }));
}

export const defaultWorkflowFormValues: CreateWorkflowFormValues = {
  name: '',
  description: '',
  jobs: [createDefaultJob(0)],
};
