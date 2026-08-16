import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksAPI, WEBHOOK_AUTO_DISABLE_THRESHOLD, isAutoDisabled } from '@/lib/api/webhooks';
import type { Webhook } from '@/lib/api/webhooks';
import { APIError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  RefreshCw,
  Trash2,
  Webhook as WebhookIcon,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pencil,
  History,
  ShieldAlert,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateWebhookDialog } from './CreateWebhookDialog';
import { EditWebhookDialog } from './EditWebhookDialog';
import { WebhookDeliveriesDialog } from './WebhookDeliveriesDialog';

function WebhookStatusBadge({ webhook }: { webhook: Webhook }) {
  if (isAutoDisabled(webhook)) {
    return (
      <Badge
        variant="outline"
        className="border-amber-600 bg-amber-500/10 text-amber-700"
        title={`Spooled disabled this webhook after ${WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive failed deliveries. It is not receiving events until you re-enable it.`}
      >
        <ShieldAlert className="mr-1 h-3 w-3" />
        Auto-disabled
      </Badge>
    );
  }
  if (!webhook.enabled) {
    return (
      <Badge
        variant="outline"
        className="border-gray-500 text-gray-600"
        title="Turned off manually"
      >
        Disabled
      </Badge>
    );
  }
  if (webhook.last_status === 'failed') {
    return (
      <Badge variant="outline" className="border-red-500 text-red-600">
        <XCircle className="mr-1 h-3 w-3" />
        Failing
      </Badge>
    );
  }
  if (webhook.last_status === 'success') {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <CheckCircle className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  }
  if (webhook.last_status === 'auto_disabled') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600"
        title={`Re-enabled after Spooled disabled it for ${WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive failed deliveries. The status updates once the next delivery is attempted.`}
      >
        <Power className="mr-1 h-3 w-3" />
        Re-enabled
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-gray-500 text-gray-600"
      title="Enabled, but nothing has been delivered yet"
    >
      No deliveries yet
    </Badge>
  );
}

function WebhooksListContent() {
  const queryClient = useQueryClient();
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<Webhook | null>(null);

  const {
    data: webhooks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.webhooks.list(),
    queryFn: () => webhooksAPI.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksAPI.delete(id),
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
    onError: (error) => {
      toast.error('Failed to delete webhook', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksAPI.test(id),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Webhook test successful!', {
          description: `Status: ${result.status_code}, Response time: ${result.response_time_ms}ms`,
        });
      } else {
        toast.error('Webhook test failed', {
          description: result.error || 'Unknown error',
        });
      }
    },
    onError: (error) => {
      toast.error('Test failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const reEnableMutation = useMutation({
    mutationFn: (id: string) => webhooksAPI.update(id, { enabled: true }),
    onSuccess: (webhook) => {
      toast.success('Webhook re-enabled', {
        description: `"${webhook.name}" will receive events again`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
    onError: (error) => {
      // Re-enabling is charged against the plan webhook cap, so it can be refused outright.
      if (error instanceof APIError && error.isQuotaExceeded()) {
        toast.error('Webhook limit reached', {
          description:
            'Re-enabling counts against your plan’s webhook limit. Delete or disable another webhook, or upgrade your plan, then try again.',
        });
        return;
      }
      toast.error('Failed to re-enable webhook', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleTest = (webhook: Webhook) => {
    testMutation.mutate(webhook.id);
  };

  const handleReEnable = (webhook: Webhook) => {
    reEnableMutation.mutate(webhook.id);
  };

  const handleDelete = (webhook: Webhook) => {
    if (confirm(`Delete webhook "${webhook.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(webhook.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Outgoing Webhooks</h1>
          <p className="text-muted-foreground">
            Configure HTTP endpoints to receive notifications when job/queue events occur
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreateWebhookDialog
            onSuccess={() => {
              refetch();
            }}
          />
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-700">HTTP Notifications from Spooled</p>
              <p className="text-sm text-blue-600/80">
                Spooled will POST to your configured URLs when events occur (job.completed,
                queue.paused, etc.). Track delivery history and test endpoints.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load webhooks</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <WebhookIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No webhooks configured</p>
              <p className="text-sm">
                Create a webhook to receive HTTP notifications from Spooled when events occur
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="hover:bg-muted/30 p-6 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-lg font-semibold">{webhook.name}</span>
                        <WebhookStatusBadge webhook={webhook} />
                        {webhook.failure_count > 0 && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600"
                            title={`Consecutive failed deliveries, counted once per delivery rather than per retry attempt. At ${WEBHOOK_AUTO_DISABLE_THRESHOLD} the webhook is disabled automatically. A successful delivery resets the count to 0.`}
                          >
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {webhook.failure_count}/{WEBHOOK_AUTO_DISABLE_THRESHOLD} consecutive
                            failed deliveries
                          </Badge>
                        )}
                      </div>

                      <p className="mb-3 font-mono text-sm text-muted-foreground">{webhook.url}</p>

                      {isAutoDisabled(webhook) && (
                        <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
                          <div className="flex items-start gap-3">
                            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-700">
                                Disabled automatically after {WEBHOOK_AUTO_DISABLE_THRESHOLD}{' '}
                                consecutive failed deliveries
                              </p>
                              <p className="mt-1 text-sm text-amber-600/80">
                                Spooled stopped sending events to this endpoint. Fix the endpoint,
                                then re-enable it — re-enabling counts against your plan’s webhook
                                limit, so it can be refused if you are already at the cap.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 border-amber-500 text-amber-700"
                                onClick={() => handleReEnable(webhook)}
                                disabled={reEnableMutation.isPending}
                              >
                                <Power className="mr-2 h-4 w-4" />
                                {reEnableMutation.isPending &&
                                reEnableMutation.variables === webhook.id
                                  ? 'Re-enabling...'
                                  : 'Re-enable'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mb-3 flex flex-wrap gap-1">
                        {webhook.events.slice(0, 4).map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.events.length - 4} more
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created {formatRelativeTime(webhook.created_at)}</span>
                        {webhook.last_triggered_at && (
                          <span>
                            Last triggered {formatRelativeTime(webhook.last_triggered_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <span
                        title={
                          webhook.enabled
                            ? 'Send a sample payload to this endpoint'
                            : isAutoDisabled(webhook)
                              ? 'Testing is unavailable while a webhook is disabled. Re-enable it to send a test payload.'
                              : 'Testing is unavailable while a webhook is disabled. Enable it to send a test payload.'
                        }
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(webhook)}
                          disabled={testMutation.isPending || !webhook.enabled}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          Test
                        </Button>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingDeliveries(webhook)}
                        title="View Delivery History"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingWebhook(webhook)}
                        title="Edit Webhook"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(webhook)}
                        disabled={deleteMutation.isPending}
                        title="Delete Webhook"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingWebhook && (
        <EditWebhookDialog
          webhook={editingWebhook}
          open={!!editingWebhook}
          onOpenChange={(open) => !open && setEditingWebhook(null)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Deliveries Dialog */}
      {viewingDeliveries && (
        <WebhookDeliveriesDialog
          webhook={viewingDeliveries}
          open={!!viewingDeliveries}
          onOpenChange={(open) => !open && setViewingDeliveries(null)}
        />
      )}
    </div>
  );
}

export function WebhooksListPage() {
  return (
    <ProtectedPage>
      <WebhooksListContent />
    </ProtectedPage>
  );
}
