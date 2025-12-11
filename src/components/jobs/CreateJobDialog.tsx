import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateJobRequest, BackoffType } from '@/lib/types';

interface CreateJobDialogProps {
  trigger?: React.ReactNode;
  defaultQueue?: string;
  onSuccess?: (jobId: string) => void;
}

export function CreateJobDialog({ trigger, defaultQueue, onSuccess }: CreateJobDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [queue, setQueue] = useState(defaultQueue || '');
  const [jobType, setJobType] = useState('');
  const [payload, setPayload] = useState('{\n  \n}');
  const [priority, setPriority] = useState('0');
  const [maxRetries, setMaxRetries] = useState('3');
  const [backoffType, setBackoffType] = useState<BackoffType>('exponential');
  const [timeoutMs, setTimeoutMs] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [metadata, setMetadata] = useState('');

  // Fetch queues for dropdown
  const { data: queues } = useQuery({
    queryKey: queryKeys.queues.list(),
    queryFn: () => queuesAPI.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateJobRequest) => jobsAPI.create(data),
    onSuccess: (job) => {
      toast.success('Job created', { description: `Job ID: ${job.id.slice(0, 8)}...` });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      setOpen(false);
      resetForm();
      onSuccess?.(job.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    },
  });

  const resetForm = () => {
    setQueue(defaultQueue || '');
    setJobType('');
    setPayload('{\n  \n}');
    setPriority('0');
    setMaxRetries('3');
    setBackoffType('exponential');
    setTimeoutMs('');
    setScheduledAt('');
    setMetadata('');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!queue) {
      setError('Queue is required');
      return;
    }
    if (!jobType) {
      setError('Job type is required');
      return;
    }

    // Parse payload JSON
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Invalid JSON payload');
      return;
    }

    // Parse metadata if provided
    let parsedMetadata: Record<string, string> | undefined;
    if (metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        setError('Invalid JSON metadata');
        return;
      }
    }

    const request: CreateJobRequest = {
      queue,
      job_type: jobType,
      payload: parsedPayload,
      priority: parseInt(priority) || 0,
      max_retries: parseInt(maxRetries) || 3,
      backoff_type: backoffType,
      timeout_ms: timeoutMs ? parseInt(timeoutMs) : undefined,
      scheduled_at: scheduledAt || undefined,
      metadata: parsedMetadata,
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
            Create Job
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
            <DialogDescription>Add a new job to the queue for processing.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Queue Selection */}
            <div className="grid gap-2">
              <Label htmlFor="queue">Queue *</Label>
              <Select value={queue} onValueChange={setQueue}>
                <SelectTrigger id="queue">
                  <SelectValue placeholder="Select a queue" />
                </SelectTrigger>
                <SelectContent>
                  {queues?.map((q) => (
                    <SelectItem key={q.name} value={q.name}>
                      {q.name}
                      {q.paused && ' (paused)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Type */}
            <div className="grid gap-2">
              <Label htmlFor="jobType">Job Type *</Label>
              <Input
                id="jobType"
                placeholder="e.g., send_email, process_payment"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              />
            </div>

            {/* Payload */}
            <div className="grid gap-2">
              <Label htmlFor="payload">Payload (JSON) *</Label>
              <Textarea
                id="payload"
                placeholder='{"key": "value"}'
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="min-h-[120px] font-mono"
              />
            </div>

            {/* Priority & Retries */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  placeholder="0"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Higher = processed first</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxRetries">Max Retries</Label>
                <Input
                  id="maxRetries"
                  type="number"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                />
              </div>
            </div>

            {/* Backoff & Timeout */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="backoffType">Backoff Type</Label>
                <Select value={backoffType} onValueChange={(v) => setBackoffType(v as BackoffType)}>
                  <SelectTrigger id="backoffType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exponential">Exponential</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                <Input
                  id="timeoutMs"
                  type="number"
                  placeholder="Default from queue"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                />
              </div>
            </div>

            {/* Scheduled At */}
            <div className="grid gap-2">
              <Label htmlFor="scheduledAt">Schedule For (optional)</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty to process immediately</p>
            </div>

            {/* Metadata */}
            <div className="grid gap-2">
              <Label htmlFor="metadata">Metadata (JSON, optional)</Label>
              <Textarea
                id="metadata"
                placeholder='{"trace_id": "abc123"}'
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                className="min-h-[60px] font-mono"
              />
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
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
