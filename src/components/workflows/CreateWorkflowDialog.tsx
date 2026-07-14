import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsAPI } from '@/lib/api/workflows';
import type { CreateWorkflowRequest } from '@/lib/api/workflows';
import { queuesAPI } from '@/lib/api/queues';
import { queryKeys } from '@/lib/query-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, AlertCircle, GitBranch, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { focusFirstFormError, useDialogFocusRestore } from '@/lib/utils/form';
import {
  createDefaultJob,
  createWorkflowSchema,
  defaultWorkflowFormValues,
  type CreateWorkflowFormValues,
} from './create-workflow-schema';

interface CreateWorkflowDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (workflowId: string) => void;
}

function fieldErrorId(name: string) {
  return `${name}-error`;
}

export function CreateWorkflowDialog({ trigger, onSuccess }: CreateWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { wrapTrigger, onCloseAutoFocus } = useDialogFocusRestore();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkflowFormValues>({
    resolver: zodResolver(createWorkflowSchema),
    defaultValues: defaultWorkflowFormValues,
    mode: 'onSubmit',
  });

  const { fields, append } = useFieldArray({
    control,
    name: 'jobs',
    keyName: 'fieldId',
  });

  const { data: queues } = useQuery({
    queryKey: queryKeys.queues.list(),
    queryFn: () => queuesAPI.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateWorkflowRequest) => workflowsAPI.create(data),
    onSuccess: (workflow) => {
      toast.success('Workflow created', { description: workflow.name || workflow.id });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      setOpen(false);
      resetForm();
      onSuccess?.(workflow.id);
    },
    onError: (err) => {
      setServerError(err instanceof Error ? err.message : 'Failed to create workflow');
    },
  });

  const resetForm = () => {
    reset(defaultWorkflowFormValues);
    setServerError(null);
  };

  const addJob = () => {
    const jobs = getValues('jobs');
    const previousKey = jobs[jobs.length - 1]?.key;
    append(createDefaultJob(jobs.length, previousKey, String(Date.now())));
  };

  const removeJob = (index: number) => {
    const jobs = getValues('jobs');
    if (jobs.length <= 1) return;

    const removedKey = jobs[index]?.key;
    setValue(
      'jobs',
      jobs
        .filter((_, jobIndex) => jobIndex !== index)
        .map((job: CreateWorkflowFormValues['jobs'][number]) => ({
          ...job,
          depends_on: job.depends_on.filter((dep) => dep !== removedKey),
        }))
    );
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setServerError(null);

      const request: CreateWorkflowRequest = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        jobs: values.jobs.map((job) => ({
          key: job.key,
          queue_name: job.queue_name,
          job_type: job.job_type,
          payload: {},
          depends_on: job.depends_on,
          dependency_type: 'success',
        })),
      };

      await createMutation.mutateAsync(request);
    },
    (validationErrors) => {
      focusFirstFormError(validationErrors, setFocus);
    }
  );

  const isBusy = createMutation.isPending || isSubmitting;
  const defaultTrigger = (
    <Button size="sm">
      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
      Create Workflow
    </Button>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{wrapTrigger(trigger ?? defaultTrigger)}</DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Define a workflow with multiple jobs and their dependencies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="workflow-name">Workflow Name *</Label>
              <Input
                id="workflow-name"
                placeholder="e.g., Data Processing Pipeline"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? fieldErrorId('workflow-name') : undefined}
                disabled={isBusy}
                {...register('name')}
              />
              {errors.name && (
                <p
                  id={fieldErrorId('workflow-name')}
                  className="text-sm text-destructive"
                  role="alert"
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                placeholder="Optional description"
                className="min-h-[60px]"
                disabled={isBusy}
                {...register('description')}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label id="workflow-jobs-label">Jobs *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addJob}
                  disabled={isBusy}
                >
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Add Job
                </Button>
              </div>
              {errors.jobs?.root && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.jobs.root.message}
                </p>
              )}
              {errors.jobs?.message && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.jobs.message}
                </p>
              )}

              <div className="space-y-3" aria-labelledby="workflow-jobs-label">
                {fields.map((job, index) => {
                  const jobErrors = errors.jobs?.[index];
                  const queueErrorId = fieldErrorId(`job-${index}-queue`);
                  const typeErrorId = fieldErrorId(`job-${index}-type`);
                  const keyErrorId = fieldErrorId(`job-${index}-key`);
                  const depErrorId = fieldErrorId(`job-${index}-depends-on`);

                  return (
                    <Card key={job.fieldId}>
                      <CardHeader className="p-3 pb-0">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">Job {index + 1}</CardTitle>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeJob(index)}
                              disabled={isBusy}
                              aria-label={`Remove job ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 p-3 pt-2">
                        <div className="grid gap-1">
                          <Label htmlFor={`job-${index}-key`} className="text-xs">
                            Job Key *
                          </Label>
                          <Input
                            id={`job-${index}-key`}
                            placeholder="e.g., extract"
                            aria-invalid={Boolean(jobErrors?.key)}
                            aria-describedby={jobErrors?.key ? keyErrorId : undefined}
                            disabled={isBusy}
                            {...register(`jobs.${index}.key`)}
                          />
                          {jobErrors?.key && (
                            <p id={keyErrorId} className="text-xs text-destructive" role="alert">
                              {jobErrors.key.message}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1">
                            <Label htmlFor={`job-${index}-queue`} className="text-xs">
                              Queue *
                            </Label>
                            <Controller
                              control={control}
                              name={`jobs.${index}.queue_name`}
                              render={({ field }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={isBusy}
                                >
                                  <SelectTrigger
                                    id={`job-${index}-queue`}
                                    aria-invalid={Boolean(jobErrors?.queue_name)}
                                    aria-describedby={
                                      jobErrors?.queue_name ? queueErrorId : undefined
                                    }
                                  >
                                    <SelectValue placeholder="Select queue" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {queues?.map((q) => (
                                      <SelectItem key={q.name} value={q.name}>
                                        {q.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {jobErrors?.queue_name && (
                              <p
                                id={queueErrorId}
                                className="text-xs text-destructive"
                                role="alert"
                              >
                                {jobErrors.queue_name.message}
                              </p>
                            )}
                          </div>
                          <div className="grid gap-1">
                            <Label htmlFor={`job-${index}-type`} className="text-xs">
                              Job Type *
                            </Label>
                            <Input
                              id={`job-${index}-type`}
                              placeholder="e.g., process_data"
                              aria-invalid={Boolean(jobErrors?.job_type)}
                              aria-describedby={jobErrors?.job_type ? typeErrorId : undefined}
                              disabled={isBusy}
                              {...register(`jobs.${index}.job_type`)}
                            />
                            {jobErrors?.job_type && (
                              <p id={typeErrorId} className="text-xs text-destructive" role="alert">
                                {jobErrors.job_type.message}
                              </p>
                            )}
                          </div>
                        </div>

                        {index > 0 && (
                          <div className="grid gap-1">
                            <Label htmlFor={`job-${index}-depends-on`} className="text-xs">
                              Depends On
                            </Label>
                            <Controller
                              control={control}
                              name={`jobs.${index}.depends_on`}
                              render={({ field }) => (
                                <Select
                                  value={field.value[0] ?? 'none'}
                                  onValueChange={(value) =>
                                    field.onChange(value === 'none' ? [] : [value])
                                  }
                                  disabled={isBusy}
                                >
                                  <SelectTrigger
                                    id={`job-${index}-depends-on`}
                                    aria-invalid={Boolean(jobErrors?.depends_on)}
                                    aria-describedby={
                                      jobErrors?.depends_on ? depErrorId : undefined
                                    }
                                  >
                                    <SelectValue placeholder="Select dependency" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">
                                      No dependency (run immediately)
                                    </SelectItem>
                                    {fields.slice(0, index).map((priorJob, priorIndex) => (
                                      <SelectItem key={priorJob.fieldId} value={priorJob.key}>
                                        Job {priorIndex + 1}: {priorJob.job_type || priorJob.key}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {jobErrors?.depends_on && (
                              <p id={depErrorId} className="text-xs text-destructive" role="alert">
                                {jobErrors.depends_on.message}
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {fields.length > 1 && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <GitBranch className="h-4 w-4" aria-hidden="true" />
                  <span>Jobs execute based on their dependencies</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy} aria-busy={isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create Workflow
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
