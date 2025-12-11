import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { schedulesAPI } from '@/lib/api/schedules';
import type { CreateScheduleRequest } from '@/lib/api/schedules';
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
import { Plus, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CreateScheduleDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (scheduleId: string) => void;
}

const COMMON_CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'First day of month at midnight', value: '0 0 1 * *' },
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export function CreateScheduleDialog({ trigger, onSuccess }: CreateScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('0 * * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [queue, setQueue] = useState('');
  const [jobType, setJobType] = useState('');
  const [payload, setPayload] = useState('{\n  \n}');

  // Fetch queues for dropdown
  const { data: queues } = useQuery({
    queryKey: queryKeys.queues.list(),
    queryFn: () => queuesAPI.list(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateScheduleRequest) => schedulesAPI.create(data),
    onSuccess: (schedule) => {
      toast.success('Schedule created', { description: schedule.name });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      setOpen(false);
      resetForm();
      onSuccess?.(schedule.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setCronExpression('0 * * * *');
    setTimezone('UTC');
    setQueue('');
    setJobType('');
    setPayload('{\n  \n}');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim()) {
      setError('Schedule name is required');
      return;
    }
    if (!cronExpression.trim()) {
      setError('Cron expression is required');
      return;
    }
    if (!queue) {
      setError('Queue is required');
      return;
    }
    if (!jobType.trim()) {
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

    const request: CreateScheduleRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      cron_expression: cronExpression.trim(),
      timezone,
      queue,
      job_type: jobType.trim(),
      payload: parsedPayload,
      enabled: true,
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
            Create Schedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring job schedule using cron expressions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Schedule Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Daily Report, Hourly Cleanup"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Cron Expression */}
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cronExpression">Cron Expression *</Label>
                <a
                  href="https://crontab.guru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <HelpCircle className="h-4 w-4" />
                </a>
              </div>
              <Input
                id="cronExpression"
                placeholder="* * * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {COMMON_CRON_PRESETS.slice(0, 4).map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setCronExpression(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                placeholder="e.g., generate_report, cleanup_old_data"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
              />
            </div>

            {/* Payload */}
            <div className="grid gap-2">
              <Label htmlFor="payload">Payload (JSON)</Label>
              <Textarea
                id="payload"
                placeholder='{"key": "value"}'
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="min-h-[100px] font-mono"
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
                  Create Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
