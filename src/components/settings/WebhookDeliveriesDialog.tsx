import { useQuery } from '@tanstack/react-query';
import { webhooksAPI } from '@/lib/api/webhooks';
import type { Webhook, WebhookDelivery } from '@/lib/api/webhooks';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

interface WebhookDeliveriesDialogProps {
  webhook: Webhook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeliveryStatusBadge({ status }: { status: WebhookDelivery['status'] }) {
  switch (status) {
    case 'success':
      return (
        <Badge className="border-green-500 bg-green-500/10 text-green-700">
          <CheckCircle className="mr-1 h-3 w-3" />
          Success
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
}

export function WebhookDeliveriesDialog({
  webhook,
  open,
  onOpenChange,
}: WebhookDeliveriesDialogProps) {
  const {
    data: deliveries,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.webhooks.deliveries(webhook.id),
    queryFn: () => webhooksAPI.getDeliveries(webhook.id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Delivery History</DialogTitle>
              <DialogDescription>Recent webhook deliveries for "{webhook.name}"</DialogDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-destructive" />
              <p className="text-destructive">Failed to load deliveries</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No deliveries yet</p>
              <p className="text-sm">Deliveries will appear here when the webhook is triggered</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <Card key={delivery.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
                          <DeliveryStatusBadge status={delivery.status} />
                          <Badge variant="outline" className="text-xs">
                            {delivery.event}
                          </Badge>
                          {delivery.status_code && (
                            <span className="text-xs text-muted-foreground">
                              HTTP {delivery.status_code}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Created: {formatRelativeTime(delivery.created_at)}</p>
                          {delivery.delivered_at && (
                            <p>Delivered: {formatRelativeTime(delivery.delivered_at)}</p>
                          )}
                          <p>Attempts: {delivery.attempts}</p>
                        </div>

                        {delivery.error && (
                          <div className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                            <strong>Error:</strong> {delivery.error}
                          </div>
                        )}

                        {delivery.payload && Object.keys(delivery.payload).length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              View Payload
                            </summary>
                            <pre className="mt-2 max-h-32 overflow-x-auto rounded bg-muted p-2 text-xs">
                              {JSON.stringify(delivery.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
