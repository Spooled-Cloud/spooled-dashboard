import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsAPI } from '@/lib/api/workflows';
import type { CreateWorkflowRequest, WorkflowJob } from '@/lib/api/workflows';
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

interface CreateWorkflowDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (workflowId: string) => void;
}

interface WorkflowJobInput extends WorkflowJob {
  tempId: string; // UI-only field for managing job list
}

export function CreateWorkflowDialog({ trigger, onSuccess }: CreateWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobs, setJobs] = useState<WorkflowJobInput[]>([
    { tempId: '1', key: '1', queue_name: '', job_type: '', payload: {}, depends_on: [] },
  ]);

  // Fetch available queues
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
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setJobs([{ tempId: '1', key: '1', queue_name: '', job_type: '', payload: {}, depends_on: [] }]);
    setError(null);
  };

  const addJob = () => {
    const newId = String(Date.now());
    setJobs([
      ...jobs,
      {
        tempId: newId,
        key: newId,
        queue_name: '',
        job_type: '',
        payload: {},
        depends_on: jobs.length > 0 ? [jobs[jobs.length - 1].tempId] : [],
      },
    ]);
  };

  const removeJob = (tempId: string) => {
    if (jobs.length <= 1) return;

    setJobs(
      jobs
        .filter((j) => j.tempId !== tempId)
        .map((j) => ({
          ...j,
          depends_on: j.depends_on?.filter((id) => id !== tempId),
        }))
    );
  };

  const updateJob = (tempId: string, updates: Partial<WorkflowJobInput>) => {
    setJobs(jobs.map((j) => (j.tempId === tempId ? { ...j, ...updates } : j)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim()) {
      setError('Workflow name is required');
      return;
    }
    if (jobs.length === 0) {
      setError('At least one job is required');
      return;
    }

    // Validate each job
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!job.queue_name) {
        setError(`Job ${i + 1}: Queue is required`);
        return;
      }
      if (!job.job_type.trim()) {
        setError(`Job ${i + 1}: Job type is required`);
        return;
      }
    }

    const request: CreateWorkflowRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      jobs: jobs.map((j) => ({
        key: j.tempId, // Use tempId as the job key
        queue_name: j.queue_name,
        job_type: j.job_type,
        payload: j.payload,
        depends_on: j.depends_on,
        dependency_type: 'success',
      })),
    };

    createMutation.mutate(request);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Define a workflow with multiple jobs and their dependencies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Workflow Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Workflow Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Data Processing Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Jobs */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Jobs *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addJob}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Job
                </Button>
              </div>

              <div className="space-y-3">
                {jobs.map((job, index) => (
                  <Card key={job.tempId}>
                    <CardHeader className="p-3 pb-0">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Job {index + 1}</CardTitle>
                        {jobs.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeJob(job.tempId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1">
                          <Label className="text-xs">Queue *</Label>
                          <Select
                            value={job.queue_name}
                            onValueChange={(v) => updateJob(job.tempId, { queue_name: v })}
                          >
                            <SelectTrigger>
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
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Job Type *</Label>
                          <Input
                            placeholder="e.g., process_data"
                            value={job.job_type}
                            onChange={(e) => updateJob(job.tempId, { job_type: e.target.value })}
                          />
                        </div>
                      </div>

                      {index > 0 && (
                        <div className="grid gap-1">
                          <Label className="text-xs">Depends On</Label>
                          <Select
                            value={job.depends_on?.[0] || 'none'}
                            onValueChange={(v) =>
                              updateJob(job.tempId, {
                                depends_on: v === 'none' ? [] : [v],
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select dependency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No dependency (run immediately)</SelectItem>
                              {jobs.slice(0, index).map((j, i) => (
                                <SelectItem key={j.tempId} value={j.tempId}>
                                  Job {i + 1}: {j.job_type || '(unnamed)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Visual Flow */}
              {jobs.length > 1 && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span>Jobs will execute based on their dependencies</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
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
