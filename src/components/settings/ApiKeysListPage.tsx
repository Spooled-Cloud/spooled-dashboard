import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysAPI, getApiKeyStatus } from '@/lib/api/api-keys';
import type { APIKey } from '@/lib/api/api-keys';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { RefreshCw, Trash2, Key, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';

function ApiKeyStatusBadge({ apiKey }: { apiKey: APIKey }) {
  const status = getApiKeyStatus(apiKey);
  switch (status) {
    case 'active':
      return <Badge className="border-green-500 bg-green-500/10 text-green-700">Active</Badge>;
    case 'revoked':
      return <Badge variant="destructive">Revoked</Badge>;
    case 'expired':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Expired
        </Badge>
      );
    default:
      return null;
  }
}

function ApiKeysListContent() {
  const queryClient = useQueryClient();

  const {
    data: apiKeys,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: () => apiKeysAPI.list(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysAPI.revoke(id),
    onSuccess: () => {
      toast.success('API key revoked', { description: 'The key has been permanently invalidated' });
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
    onError: (error) => {
      toast.error('Failed to revoke API key', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleRevoke = (apiKey: APIKey) => {
    if (
      confirm(
        `Revoke API key "${apiKey.name}"? This action cannot be undone and will immediately invalidate the key.`
      )
    ) {
      revokeMutation.mutate(apiKey.id);
    }
  };

  const activeKeys = apiKeys?.filter((k) => k.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreateApiKeyDialog
            onSuccess={() => {
              refetch();
            }}
          />
        </div>
      </div>

      {/* Summary Card */}
      {!isLoading && apiKeys && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Keys</p>
                  <p className="text-2xl font-bold">{apiKeys.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeKeys}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gray-500/10 p-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Revoked/Expired</p>
                  <p className="text-2xl font-bold text-gray-600">{apiKeys.length - activeKeys}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Important Notice */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-700">Security Notice</p>
              <p className="text-sm text-amber-600/80">
                API keys are only shown once when created. Store them securely and never expose them
                in client-side code or version control.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-destructive">Failed to load API keys</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred'}
              </p>
            </div>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Key className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="mb-1 text-lg font-medium">No API keys found</p>
              <p className="text-sm">Create your first API key to enable programmatic access</p>
            </div>
          ) : (
            <div className="divide-y">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="p-6 transition-colors hover:bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-lg font-semibold">{apiKey.name}</span>
                        <ApiKeyStatusBadge apiKey={apiKey} />
                      </div>

                      <div className="mt-3 flex items-center gap-6">
                        <div>
                          <p className="text-xs text-muted-foreground">Queue Access</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {apiKey.queues.slice(0, 3).map((queue) => (
                              <Badge key={queue} variant="outline" className="text-xs font-mono">
                                {queue === '*' ? 'all queues' : queue}
                              </Badge>
                            ))}
                            {apiKey.queues.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{apiKey.queues.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        {apiKey.rate_limit && (
                          <div>
                            <p className="text-xs text-muted-foreground">Rate Limit</p>
                            <p className="mt-1 text-sm">{apiKey.rate_limit} req/s</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created {formatRelativeTime(apiKey.created_at)}</span>
                        {apiKey.last_used && (
                          <span>Last used {formatRelativeTime(apiKey.last_used)}</span>
                        )}
                        {apiKey.expires_at && (
                          <span>Expires {formatRelativeTime(apiKey.expires_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      {apiKey.is_active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(apiKey)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ApiKeysListPage() {
  return (
    <ProtectedPage>
      <ApiKeysListContent />
    </ProtectedPage>
  );
}
