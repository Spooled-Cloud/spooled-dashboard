import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysAPI, API_KEY_PERMISSIONS } from '@/lib/api/api-keys';
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
import { Card, CardContent } from '@/components/ui/card';
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
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
    setSelectedPermissions([]);
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
    if (selectedPermissions.length === 0) {
      setError('Select at least one permission');
      return;
    }

    const request: CreateAPIKeyRequest = {
      name: name.trim(),
      permissions: selectedPermissions,
      expires_at: expiresAt || undefined,
    };

    createMutation.mutate(request);
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(API_KEY_PERMISSIONS.map((p) => p.value));
  };

  const clearPermissions = () => {
    setSelectedPermissions([]);
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
                <p className="font-mono">{createdKey.key_prefix}...</p>
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

            {/* Permissions */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Permissions *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={selectAllPermissions}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={clearPermissions}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="grid grid-cols-1 gap-2 p-3">
                  {API_KEY_PERMISSIONS.map((permission) => (
                    <label
                      key={permission.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.value)}
                        onChange={() => togglePermission(permission.value)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium">{permission.label}</p>
                        <p className="text-xs text-muted-foreground">{permission.description}</p>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                Selected: {selectedPermissions.length} permission
                {selectedPermissions.length !== 1 ? 's' : ''}
              </p>
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
