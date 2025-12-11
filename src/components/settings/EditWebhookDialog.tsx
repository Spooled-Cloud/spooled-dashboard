import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksAPI, WEBHOOK_EVENTS } from '@/lib/api/webhooks';
import type { UpdateWebhookRequest, WebhookEvent, Webhook } from '@/lib/api/webhooks';
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
import { Loader2, AlertCircle, Save } from 'lucide-react';

interface EditWebhookDialogProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

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
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(webhook.events);
  const [enabled, setEnabled] = useState(webhook.enabled);

  // Reset form when webhook changes
  useEffect(() => {
    setName(webhook.name);
    setUrl(webhook.url);
    setSecret('');
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

    // Only include secret if it was changed
    if (secret.trim()) {
      request.secret = secret.trim();
    }

    updateMutation.mutate(request);
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

            {/* Enabled Toggle */}
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
                placeholder="Leave empty to keep current secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only fill this if you want to change the signing secret
              </p>
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
                      className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
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
