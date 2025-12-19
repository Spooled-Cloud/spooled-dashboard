import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysAPI } from '@/lib/api/api-keys';
import type { CreateAPIKeyRequest, CreateAPIKeyResponse } from '@/lib/api/api-keys';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, AlertCircle, Copy, CheckCheck, Key, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface CreateApiKeyDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: (keyId: string) => void;
}

export function CreateApiKeyDialog({ trigger, onSuccess }: CreateApiKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [queuesText, setQueuesText] = useState('*');
  const [rateLimit, setRateLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: CreateAPIKeyRequest) => apiKeysAPI.create(data),
    onSuccess: (response) => {
      toast.success('API key created', { description: 'Make sure to copy your key now!' });
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      setCreatedKey(response);
      onSuccess?.(response.id);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    },
  });

  const resetForm = () => {
    setName('');
    setQueuesText('*');
    setRateLimit('');
    setExpiresAt('');
    setError(null);
    setCreatedKey(null);
    setCopied(false);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim()) {
      setError('API key name is required');
      return;
    }
    // queuesText can be empty (means all queues). If provided, validate basic format.
    const rawQueues = queuesText
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
    const queues = rawQueues.length > 0 ? rawQueues : undefined;

    // Optional rate limit validation (backend: 1..10000)
    const parsedRateLimit = rateLimit.trim() ? Number(rateLimit.trim()) : undefined;
    if (parsedRateLimit !== undefined) {
      if (!Number.isFinite(parsedRateLimit) || !Number.isInteger(parsedRateLimit)) {
        setError('Rate limit must be an integer');
        return;
      }
      if (parsedRateLimit < 1 || parsedRateLimit > 10000) {
        setError('Rate limit must be between 1 and 10000');
        return;
      }
    }

    const request: CreateAPIKeyRequest = {
      name: name.trim(),
      queues,
      rate_limit: parsedRateLimit,
      expires_at: expiresAt || undefined,
    };

    createMutation.mutate(request);
  };

  const handleCopyKey = () => {
    if (createdKey?.key) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If key was created, show the key display dialog
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-green-600" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="border-amber-500/50 bg-amber-500/5">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                <strong>Important:</strong> This is the only time you'll see this key. Copy it now
                and store it securely.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input value={createdKey.key} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={handleCopyKey} className="flex-shrink-0">
                  {copied ? (
                    <>
                      <CheckCheck className="mr-2 h-4 w-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium">{createdKey.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Key Prefix</p>
                <p className="font-mono">{createdKey.key.slice(0, 8)}...</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
            Create API Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for programmatic access to the Spooled API.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Key Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Key Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Production Server, CI/CD Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name to identify this key
              </p>
            </div>

            {/* Expiration */}
            <div className="grid gap-2">
              <Label htmlFor="expiresAt">Expiration (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for a key that never expires
              </p>
            </div>

            {/* Queues */}
            <div className="grid gap-2">
              <Label htmlFor="queues">Queues (optional)</Label>
              <Input
                id="queues"
                placeholder="* (all queues) or comma-separated, e.g. printer, emails"
                value={queuesText}
                onChange={(e) => setQueuesText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for all queues. Use <span className="font-mono">*</span> for wildcard.
              </p>
            </div>

            {/* Rate limit */}
            <div className="grid gap-2">
              <Label htmlFor="rateLimit">Rate limit (optional)</Label>
              <Input
                id="rateLimit"
                inputMode="numeric"
                placeholder="e.g. 1000"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Override rate limit for this key (1-10000)</p>
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
                  <Key className="mr-2 h-4 w-4" />
                  Create API Key
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
