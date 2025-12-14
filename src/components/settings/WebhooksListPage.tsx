import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksAPI } from '@/lib/api/webhooks';
import type { Webhook } from '@/lib/api/webhooks';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { CreateWebhookDialog } from './CreateWebhookDialog';
import { EditWebhookDialog } from './EditWebhookDialog';
import { WebhookDeliveriesDialog } from './WebhookDeliveriesDialog';

function WebhookStatusBadge({ webhook }: { webhook: Webhook }) {
  if (!webhook.enabled) {
    return (
      <Badge variant="outline" className="border-gray-500 text-gray-600">
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
  return (
    <Badge variant="outline" className="border-blue-500 text-blue-600">
      Active
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

  const handleTest = (webhook: Webhook) => {
    testMutation.mutate(webhook.id);
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
                Spooled will POST to your configured URLs when events occur (job.completed, queue.paused, etc.). Track delivery history and test endpoints.
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
                <div key={webhook.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-lg font-semibold">{webhook.name}</span>
                        <WebhookStatusBadge webhook={webhook} />
                        {webhook.failure_count > 0 && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            {webhook.failure_count} failures
                          </Badge>
                        )}
                      </div>

                      <p className="mb-3 font-mono text-sm text-muted-foreground">{webhook.url}</p>

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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(webhook)}
                        disabled={testMutation.isPending || !webhook.enabled}
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Test
                      </Button>
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
