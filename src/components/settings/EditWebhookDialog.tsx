import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  webhooksAPI,
  WEBHOOK_EVENTS,
  WEBHOOK_AUTO_DISABLE_THRESHOLD,
  isAutoDisabled,
} from '@/lib/api/webhooks';
import type { UpdateWebhookRequest, WebhookEvent, Webhook } from '@/lib/api/webhooks';
import { APIError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Save, ShieldOff } from 'lucide-react';

interface EditWebhookDialogProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * What to do with the signing secret on save.
 *
 * `keep` omits the field entirely so the backend leaves the stored secret alone — anything else
 * would overwrite it. `clear` sends an explicit null, which removes the secret for good.
 */
type SecretAction = 'keep' | 'replace' | 'clear';

export function EditWebhookDialog({
  webhook,
  open,
  onOpenChange,
  onSuccess,
}: EditWebhookDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState(webhook.name);
  const [url, setUrl] = useState(webhook.url);
  const [secret, setSecret] = useState('');
  const [removeSecret, setRemoveSecret] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(webhook.events);
  const [enabled, setEnabled] = useState(webhook.enabled);

  const autoDisabled = isAutoDisabled(webhook);
  const isReEnabling = !webhook.enabled && enabled;

  // Reset form when webhook changes
  useEffect(() => {
    setName(webhook.name);
    setUrl(webhook.url);
    setSecret('');
    setRemoveSecret(false);
    setSelectedEvents(webhook.events);
    setEnabled(webhook.enabled);
    setError(null);
  }, [webhook]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateWebhookRequest) => webhooksAPI.update(webhook.id, data),
    onSuccess: () => {
      toast.success('Webhook updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      if (err instanceof APIError && err.isQuotaExceeded()) {
        setError(
          isReEnabling
            ? 'Your plan’s webhook limit is already reached, so this webhook cannot be re-enabled. Delete or disable another webhook, or upgrade your plan, then try again.'
            : 'Your plan’s webhook limit is already reached. Delete or disable another webhook, or upgrade your plan, then try again.'
        );
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim()) {
      setError('Webhook name is required');
      return;
    }
    if (!url.trim()) {
      setError('Webhook URL is required');
      return;
    }
    if (!url.startsWith('https://')) {
      setError('Webhook URL must use HTTPS');
      return;
    }
    if (selectedEvents.length === 0) {
      setError('Select at least one event');
      return;
    }

    const request: UpdateWebhookRequest = {
      name: name.trim(),
      url: url.trim(),
      events: selectedEvents,
      enabled,
    };

    // The secret field is three-state on the backend, and the difference is destructive:
    // omitting it keeps the stored secret, a string replaces it, and an explicit null wipes it.
    // Only ever send a value when the user asked for one.
    const secretAction: SecretAction = removeSecret ? 'clear' : secret.trim() ? 'replace' : 'keep';

    if (secretAction === 'replace') {
      request.secret = secret.trim();
    } else if (secretAction === 'clear') {
      request.secret = null;
    }

    if (
      secretAction === 'clear' &&
      !confirm(
        `Remove the signing secret for "${webhook.name}"?\n\n` +
          'Future deliveries will be sent unsigned, with no X-Spooled-Signature header, so your ' +
          'endpoint will no longer be able to verify that a payload came from Spooled.'
      )
    ) {
      return;
    }

    updateMutation.mutate(request);
  };

  const toggleRemoveSecret = (checked: boolean) => {
    setRemoveSecret(checked);
    if (checked) {
      setSecret('');
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const selectAllEvents = () => {
    setSelectedEvents(WEBHOOK_EVENTS.map((e) => e.value));
  };

  const clearEvents = () => {
    setSelectedEvents([]);
  };

  const selectJobEvents = () => {
    setSelectedEvents(WEBHOOK_EVENTS.filter((e) => e.value.startsWith('job.')).map((e) => e.value));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update the webhook configuration.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {autoDisabled && (
              <Alert className="border-amber-500/50 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Spooled disabled this webhook after {WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive
                  failed deliveries. It is not receiving events. Fix the endpoint first, then tick
                  Webhook Enabled below to resume deliveries.
                </AlertDescription>
              </Alert>
            )}

            {/* Enabled Toggle */}
            <div className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="enabled">Webhook Enabled</Label>
              </div>
              {isReEnabling && (
                <p className="text-xs text-muted-foreground">
                  Re-enabling counts against your plan’s webhook limit, so saving can fail if you
                  are already at the cap.
                </p>
              )}
            </div>

            {/* Webhook Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Webhook Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Production Notifications, Slack Alerts"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Webhook URL */}
            <div className="grid gap-2">
              <Label htmlFor="url">Endpoint URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://your-server.com/webhooks/spooled"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Must be an HTTPS URL that accepts POST requests
              </p>
            </div>

            {/* Secret */}
            <div className="grid gap-2">
              <Label htmlFor="secret">New Secret (optional)</Label>
              <Input
                id="secret"
                type="password"
                placeholder={
                  removeSecret
                    ? 'Secret will be removed on save'
                    : 'Leave empty to keep current secret'
                }
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                disabled={removeSecret}
              />
              <p className="text-xs text-muted-foreground">
                Leave this empty to keep the current signing secret. Fill it in to replace the
                secret with a new one.
              </p>

              <div className="border-destructive/40 flex items-start gap-3 rounded-md border p-3">
                <input
                  type="checkbox"
                  id="remove-secret"
                  checked={removeSecret}
                  onChange={(e) => toggleRemoveSecret(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div className="grid gap-1">
                  <Label
                    htmlFor="remove-secret"
                    className="flex items-center gap-2 text-destructive"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Remove signing secret
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Deletes the secret on save. Deliveries then go out <strong>unsigned</strong>,
                    with no X-Spooled-Signature header, so your endpoint can no longer verify that a
                    payload came from Spooled.
                  </p>
                </div>
              </div>
            </div>

            {/* Events */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Events *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={selectJobEvents}
                  >
                    Job Events
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={selectAllEvents}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={clearEvents}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="grid grid-cols-1 gap-2 p-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md p-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                Selected: {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
