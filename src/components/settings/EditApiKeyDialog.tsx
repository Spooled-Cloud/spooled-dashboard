import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysAPI, getApiKeyStatus } from '@/lib/api/api-keys';
import type { APIKey, UpdateAPIKeyRequest } from '@/lib/api/api-keys';
import { APIError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-client';
import { SESSION_KEY_UNKNOWN_MESSAGE, resolveCurrentKeyId } from './current-session-key';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

/** Backend limit on an API key name (`UpdateApiKeyRequest`). */
export const API_KEY_NAME_MAX_LENGTH = 100;

const SESSION_KEY_SWITCH_OFF_MESSAGE =
  'This key is your current dashboard session, so it cannot be switched off here. Sign out instead, or switch it off from another session.';

interface EditApiKeyDialogProps {
  apiKey: APIKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The key behind this dashboard session: switching it off would end the session. */
  isCurrentSession?: boolean;
}

/**
 * Words the plan-cap refusal of a re-activation (429 `QUOTA_EXCEEDED` on `api_keys`): turning a
 * revoked key back on takes one of the plan's key slots, like creating a key does.
 */
export function apiKeyCapMessage(error: APIError): string {
  const current = error.details?.current;
  const limit = error.details?.limit;
  const counts =
    typeof current === 'number' && typeof limit === 'number'
      ? ` (${current} of ${limit} active keys)`
      : '';
  return `Your plan’s API key limit is already reached${counts}, so this key cannot be re-activated. Revoke another key or upgrade your plan, then try again.`;
}

export function EditApiKeyDialog({
  apiKey,
  open,
  onOpenChange,
  isCurrentSession = false,
}: EditApiKeyDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(apiKey.name);
  const [active, setActive] = useState(apiKey.is_active);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);

  // Start from the key as it is whenever another key (or a fresher copy) is opened.
  useEffect(() => {
    setName(apiKey.name);
    setActive(apiKey.is_active);
    setError(null);
  }, [apiKey]);

  const status = getApiKeyStatus(apiKey);
  const isReactivating = !apiKey.is_active && active;

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAPIKeyRequest) => apiKeysAPI.update(apiKey.id, data),
    onSuccess: (_updated, request) => {
      toast.success(request.is_active === true ? 'API key re-activated' : 'API key updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof APIError && err.isQuotaExceeded()) {
        setError(apiKeyCapMessage(err));
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to update the API key');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('API key name is required');
      return;
    }
    if (trimmed.length > API_KEY_NAME_MAX_LENGTH) {
      setError(`API key name must be at most ${API_KEY_NAME_MAX_LENGTH} characters`);
      return;
    }

    // Only what changed is sent: everything else on the key stays as it is.
    const request: UpdateAPIKeyRequest = {};
    if (trimmed !== apiKey.name) request.name = trimmed;
    if (active !== apiKey.is_active) request.is_active = active;

    if (Object.keys(request).length === 0) {
      onOpenChange(false);
      return;
    }

    // Switching off the key behind this dashboard session would end it mid-action. The
    // checkbox is disabled for that key, but a stale or missing /auth/me must not open the
    // door: refuse here as well, and when the session key is unknown, ask again first and
    // refuse if it still is.
    if (request.is_active === false) {
      if (isCurrentSession) {
        setError(SESSION_KEY_SWITCH_OFF_MESSAGE);
        return;
      }
      setCheckingSession(true);
      let sessionKeyId: string | undefined;
      try {
        sessionKeyId = await resolveCurrentKeyId();
      } finally {
        setCheckingSession(false);
      }
      if (!sessionKeyId) {
        setError(SESSION_KEY_UNKNOWN_MESSAGE);
        return;
      }
      if (sessionKeyId === apiKey.id) {
        setError(SESSION_KEY_SWITCH_OFF_MESSAGE);
        return;
      }
    }
    updateMutation.mutate(request);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit API key</DialogTitle>
            <DialogDescription>
              Rename the key or switch it on or off. Its secret, queue access and rate limit stay as
              they are.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="edit-api-key-name">Name</Label>
              <Input
                id="edit-api-key-name"
                value={name}
                maxLength={API_KEY_NAME_MAX_LENGTH}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edit-api-key-active"
                  checked={active}
                  disabled={isCurrentSession}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-api-key-active">Key is active</Label>
              </div>
              {isCurrentSession && (
                <p className="text-xs text-muted-foreground">
                  This key is your current dashboard session, so it cannot be switched off here.
                </p>
              )}
              {isReactivating && (
                <p className="text-xs text-muted-foreground">
                  Re-activating counts against your plan’s API key limit, so saving can fail if you
                  are already at the cap.
                </p>
              )}
              {!active && apiKey.is_active && !isCurrentSession && (
                <p className="text-xs text-muted-foreground">
                  Anything using this key stops working as soon as you save. You can switch it back
                  on later.
                </p>
              )}
              {status === 'expired' && (
                <p className="text-xs text-muted-foreground">
                  This key has expired. Switching it on does not extend it; create a new key
                  instead.
                </p>
              )}
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
            <Button type="submit" disabled={updateMutation.isPending || checkingSession}>
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
