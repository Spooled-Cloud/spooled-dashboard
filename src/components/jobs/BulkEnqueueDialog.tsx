import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
import type { BulkEnqueueRequest } from '@/lib/api/jobs';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';
import { Layers, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

interface BulkEnqueueDialogProps {
  onSuccess?: (result: { success_count: number; failure_count: number }) => void;
}

export function BulkEnqueueDialog({ onSuccess }: BulkEnqueueDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [queueName, setQueueName] = useState('');
  const [jobsJson, setJobsJson] = useState(
    '[\n  { "payload": { "key": "value" } },\n  { "payload": { "key": "value2" } }\n]'
  );
  const [defaultPriority, setDefaultPriority] = useState(0);
  const [defaultMaxRetries, setDefaultMaxRetries] = useState(3);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ success_count: number; failure_count: number } | null>(
    null
  );

  const bulkMutation = useMutation({
    mutationFn: (data: BulkEnqueueRequest) => jobsAPI.bulkEnqueue(data),
    onSuccess: (data) => {
      setResult({ success_count: data.success_count, failure_count: data.failure_count });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      if (data.failure_count === 0) {
        toast.success('Jobs enqueued successfully', {
          description: `${data.success_count} job(s) added to queue`,
        });
        onSuccess?.(data);
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 1500);
      } else {
        toast.warning('Some jobs failed to enqueue', {
          description: `${data.success_count} succeeded, ${data.failure_count} failed`,
        });
      }
    },
    onError: (err) => {
      toast.error('Failed to enqueue jobs', {
        description: err instanceof Error ? err.message : 'An error occurred',
      });
      setError(err instanceof Error ? err.message : 'Failed to enqueue jobs');
    },
  });

  const resetForm = () => {
    setQueueName('');
    setJobsJson('[\n  { "payload": { "key": "value" } },\n  { "payload": { "key": "value2" } }\n]');
    setDefaultPriority(0);
    setDefaultMaxRetries(3);
    setError('');
    setResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!queueName.trim()) {
      setError('Queue name is required');
      return;
    }

    let jobs;
    try {
      jobs = JSON.parse(jobsJson);
      if (!Array.isArray(jobs)) {
        throw new Error('Jobs must be an array');
      }
      if (jobs.length === 0) {
        throw new Error('At least one job is required');
      }
      if (jobs.length > 100) {
        throw new Error('Maximum 100 jobs per request');
      }
      for (const job of jobs) {
        if (!job.payload || typeof job.payload !== 'object') {
          throw new Error('Each job must have a payload object');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
      return;
    }

    bulkMutation.mutate({
      queue_name: queueName.trim(),
      jobs,
      default_priority: defaultPriority,
      default_max_retries: defaultMaxRetries,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Layers className="mr-2 h-4 w-4" />
          Bulk Enqueue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Enqueue Jobs</DialogTitle>
          <DialogDescription>
            Enqueue multiple jobs at once (up to 100 jobs per request)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert variant={result.failure_count > 0 ? 'destructive' : 'default'}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {result.success_count} jobs enqueued successfully
                {result.failure_count > 0 && `, ${result.failure_count} failed`}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="queue">Queue Name *</Label>
            <Input
              id="queue"
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              placeholder="e.g., emails"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Default Priority</Label>
              <Input
                id="priority"
                type="number"
                min={-100}
                max={100}
                value={defaultPriority}
                onChange={(e) => setDefaultPriority(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retries">Default Max Retries</Label>
              <Input
                id="retries"
                type="number"
                min={0}
                max={100}
                value={defaultMaxRetries}
                onChange={(e) => setDefaultMaxRetries(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobs">Jobs (JSON Array) *</Label>
            <Textarea
              id="jobs"
              value={jobsJson}
              onChange={(e) => setJobsJson(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder='[{ "payload": { ... } }, ...]'
            />
            <p className="text-xs text-muted-foreground">
              Each job object must have a &quot;payload&quot; field. Optional: priority,
              idempotency_key, scheduled_at
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={bulkMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enqueuing...
                </>
              ) : (
                <>
                  <Layers className="mr-2 h-4 w-4" />
                  Enqueue Jobs
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
