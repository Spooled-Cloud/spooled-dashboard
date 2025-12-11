import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateQueueRequest } from '@/lib/types';

interface CreateQueueDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (queueName: string) => void;
}

export function CreateQueueDialog({ trigger, onSuccess }: CreateQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [concurrency, setConcurrency] = useState('10');
  const [maxRetries, setMaxRetries] = useState('3');
  const [retryDelayMs, setRetryDelayMs] = useState('1000');
  const [backoffMultiplier, setBackoffMultiplier] = useState('2');
  const [maxRetryDelayMs, setMaxRetryDelayMs] = useState('60000');
  const [jobTimeoutMs, setJobTimeoutMs] = useState('300000');

  const createMutation = useMutation({
    mutationFn: (data: CreateQueueRequest) => queuesAPI.create(data),
    onSuccess: (queue) => {
      toast.success('Queue created', { description: queue.name });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
      setOpen(false);
      resetForm();
      onSuccess?.(queue.name);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create queue');
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setConcurrency('10');
    setMaxRetries('3');
    setRetryDelayMs('1000');
    setBackoffMultiplier('2');
    setMaxRetryDelayMs('60000');
    setJobTimeoutMs('300000');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim()) {
      setError('Queue name is required');
      return;
    }

    // Validate name format (alphanumeric, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError('Queue name can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    const request: CreateQueueRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      concurrency: parseInt(concurrency) || 10,
      max_retries: parseInt(maxRetries) || 3,
      retry_delay_ms: parseInt(retryDelayMs) || 1000,
      backoff_multiplier: parseFloat(backoffMultiplier) || 2,
      max_retry_delay_ms: parseInt(maxRetryDelayMs) || 60000,
      job_timeout_ms: parseInt(jobTimeoutMs) || 300000,
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
            Create Queue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Queue</DialogTitle>
            <DialogDescription>Configure a new queue for job processing.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Queue Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Queue Name *</Label>
              <Input
                id="name"
                placeholder="e.g., emails, notifications, exports"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, underscores, and hyphens only
              </p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of what this queue is for"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Concurrency & Max Retries */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="concurrency">Concurrency</Label>
                <Input
                  id="concurrency"
                  type="number"
                  min="1"
                  max="100"
                  value={concurrency}
                  onChange={(e) => setConcurrency(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Max parallel jobs</p>
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
                <p className="text-xs text-muted-foreground">Retry attempts on failure</p>
              </div>
            </div>

            {/* Retry Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="retryDelayMs">Retry Delay (ms)</Label>
                <Input
                  id="retryDelayMs"
                  type="number"
                  min="100"
                  value={retryDelayMs}
                  onChange={(e) => setRetryDelayMs(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="backoffMultiplier">Backoff Multiplier</Label>
                <Input
                  id="backoffMultiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  value={backoffMultiplier}
                  onChange={(e) => setBackoffMultiplier(e.target.value)}
                />
              </div>
            </div>

            {/* Timeout Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxRetryDelayMs">Max Retry Delay (ms)</Label>
                <Input
                  id="maxRetryDelayMs"
                  type="number"
                  min="1000"
                  value={maxRetryDelayMs}
                  onChange={(e) => setMaxRetryDelayMs(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jobTimeoutMs">Job Timeout (ms)</Label>
                <Input
                  id="jobTimeoutMs"
                  type="number"
                  min="1000"
                  value={jobTimeoutMs}
                  onChange={(e) => setJobTimeoutMs(e.target.value)}
                />
              </div>
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
                  Create Queue
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
