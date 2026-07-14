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
import { useDialogFocusRestore } from '@/lib/utils/form';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { wrapTrigger, onCloseAutoFocus } = useDialogFocusRestore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('0 * * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [queue, setQueue] = useState('');
  const [jobType, setJobType] = useState('');
  const [payload, setPayload] = useState('{\n  \n}');

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
    setFieldErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextFieldErrors: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedCron = cronExpression.trim();
    const trimmedJobType = jobType.trim();

    if (!trimmedName) {
      nextFieldErrors.name = 'Schedule name is required';
    }
    if (!trimmedCron) {
      nextFieldErrors.cronExpression = 'Cron expression is required';
    }
    if (!queue) {
      nextFieldErrors.queue = 'Queue is required';
    }
    if (!trimmedJobType) {
      nextFieldErrors.jobType = 'Job type is required';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      const firstInvalidId =
        nextFieldErrors.name !== undefined
          ? 'schedule-name'
          : nextFieldErrors.cronExpression !== undefined
            ? 'cronExpression'
            : nextFieldErrors.queue !== undefined
              ? 'queue'
              : 'jobType';
      document.getElementById(firstInvalidId)?.focus();
      return;
    }

    setFieldErrors({});

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError('Invalid JSON payload');
      document.getElementById('payload')?.focus();
      return;
    }

    const request: CreateScheduleRequest = {
      name: trimmedName,
      description: description.trim() || undefined,
      cron_expression: trimmedCron,
      timezone,
      queue_name: queue,
      job_type: trimmedJobType,
      payload: parsedPayload,
      enabled: true,
    };

    createMutation.mutate(request);
  };

  const isBusy = createMutation.isPending;
  const defaultTrigger = (
    <Button size="sm">
      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
      Create Schedule
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
        className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Create New Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring job schedule using cron expressions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="schedule-name">Schedule Name *</Label>
              <Input
                id="schedule-name"
                placeholder="e.g., Daily Report, Hourly Cleanup"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'schedule-name-error' : undefined}
                disabled={isBusy}
              />
              {fieldErrors.name && (
                <p id="schedule-name-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isBusy}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cronExpression">Cron Expression *</Label>
                <a
                  href="https://crontab.guru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                  aria-label="Open crontab.guru cron expression helper (opens in new tab)"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
              <p id="cronExpression-help" className="text-xs text-muted-foreground">
                Use standard 5-field cron: minute, hour, day of month, month, day of week (e.g.{' '}
                <code className="font-mono">0 * * * *</code> = top of every hour). An optional
                leading seconds field is also accepted (e.g.{' '}
                <code className="font-mono">0 0 * * * *</code>).
              </p>
              <Input
                id="cronExpression"
                placeholder="0 * * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="font-mono"
                aria-invalid={Boolean(fieldErrors.cronExpression)}
                aria-describedby={
                  fieldErrors.cronExpression
                    ? 'cronExpression-error cronExpression-help'
                    : 'cronExpression-help'
                }
                disabled={isBusy}
              />
              {fieldErrors.cronExpression && (
                <p id="cronExpression-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.cronExpression}
                </p>
              )}
              <div className="flex flex-wrap gap-1">
                {COMMON_CRON_PRESETS.slice(0, 4).map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setCronExpression(preset.value)}
                    disabled={isBusy}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <p id="timezone-help" className="text-xs text-muted-foreground">
                Cron times are evaluated in this timezone. UTC is recommended unless the schedule
                should follow a specific region&apos;s local clock.
              </p>
              <Select value={timezone} onValueChange={setTimezone} disabled={isBusy}>
                <SelectTrigger id="timezone" aria-describedby="timezone-help">
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

            <div className="grid gap-2">
              <Label htmlFor="queue">Queue *</Label>
              <Select value={queue} onValueChange={setQueue} disabled={isBusy}>
                <SelectTrigger
                  id="queue"
                  aria-invalid={Boolean(fieldErrors.queue)}
                  aria-describedby={fieldErrors.queue ? 'queue-error' : undefined}
                >
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
              {fieldErrors.queue && (
                <p id="queue-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.queue}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobType">Job Type *</Label>
              <Input
                id="jobType"
                placeholder="e.g., generate_report, cleanup_old_data"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                aria-invalid={Boolean(fieldErrors.jobType)}
                aria-describedby={fieldErrors.jobType ? 'jobType-error' : undefined}
                disabled={isBusy}
              />
              {fieldErrors.jobType && (
                <p id="jobType-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.jobType}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payload">Payload (JSON)</Label>
              <Textarea
                id="payload"
                placeholder='{"key": "value"}'
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="min-h-[100px] font-mono"
                disabled={isBusy}
              />
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
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
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
