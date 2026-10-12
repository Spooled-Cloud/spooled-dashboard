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
import { APIError } from '@/lib/api/client';

/** Mirrors the backend queue-name rule (models/queue_config.rs). */
const QUEUE_NAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/;

class QueueExistsError extends Error {
  constructor(public queueName: string) {
    super(`Queue "${queueName}" already exists`);
    this.name = 'QueueExistsError';
  }
}

interface CreateQueueDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (queueName: string) => void;
}

export function CreateQueueDialog({ trigger, onSuccess }: CreateQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the typed name already has a configuration: creating would overwrite it.
  const [existingQueue, setExistingQueue] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxRetries, setMaxRetries] = useState('3');
  const [jobTimeoutMs, setJobTimeoutMs] = useState('300000');

  const createMutation = useMutation({
    mutationFn: async (data: CreateQueueRequest) => {
      // PUT /queues/{name}/config is an upsert: creating over an existing queue would
      // silently reset its retries and timeout. Refuse and point at the edit page.
      try {
        await queuesAPI.get(data.name);
        throw new QueueExistsError(data.name);
      } catch (err) {
        if (!(err instanceof APIError && err.status === 404)) throw err;
      }
      return queuesAPI.create(data);
    },
    onSuccess: (queue) => {
      toast.success('Queue created', { description: queue.name });
      queryClient.invalidateQueries({ queryKey: queryKeys.queues.list() });
      setOpen(false);
      resetForm();
      onSuccess?.(queue.name);
    },
    onError: (err) => {
      if (err instanceof QueueExistsError) {
        setExistingQueue(err.queueName);
        setError(`A queue named "${err.queueName}" already exists.`);
        return;
      }
      if (err instanceof APIError && err.isQuotaExceeded()) {
        setError(
          `${err.message} Compare plans at spooled.cloud/pricing, then manage billing in Settings.`
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to create queue');
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setMaxRetries('3');
    setJobTimeoutMs('300000');
    setError(null);
    setExistingQueue(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingQueue(null);

    // Validate required fields
    if (!name.trim()) {
      setError('Queue name is required');
      return;
    }

    // Same rule as the backend: letters, numbers, dashes, underscores and dots; no leading dot or dash
    if (!QUEUE_NAME_PATTERN.test(name.trim())) {
      setError(
        'Queue name can only contain letters, numbers, underscores, dashes, and dots, and cannot start with a dot or dash'
      );
      return;
    }

    const request: CreateQueueRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      max_retries: Number.isNaN(parseInt(maxRetries)) ? 3 : parseInt(maxRetries),
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
                <AlertDescription>
                  {error}
                  {existingQueue && (
                    <>
                      {' '}
                      <a
                        href={`/queues/${encodeURIComponent(existingQueue)}`}
                        className="font-medium underline"
                      >
                        Edit it instead
                      </a>
                    </>
                  )}
                </AlertDescription>
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
                Letters, numbers, underscores, dashes, and dots; cannot start with a dot or dash
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

            {/* Max Retries & Job Timeout */}
            <div className="grid grid-cols-2 gap-4">
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
