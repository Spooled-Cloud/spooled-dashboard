import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsAPI } from '@/lib/api/organizations';
import type { UpdateOrganizationRequest } from '@/lib/api/organizations';
import type { Organization } from '@/lib/types';
import { useAuthStore } from '@/stores/auth';
import { queryKeys } from '@/lib/query-client';
import { formatRelativeTime } from '@/lib/utils/format';
import { copyText } from '@/lib/utils/clipboard';
import { isUnrestrictedKey } from '@/lib/utils/key-scope';
import { APIError } from '@/lib/api/client';
import {
  Save,
  Loader2,
  Building,
  Users,
  Webhook,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { UsageWidget } from '@/components/usage/UsageWidget';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * Email sign-in only resolves an organization by a confirmed billing email, so
 * an address set through the API (or at onboarding) has to be confirmed with a
 * code sent to it before it can be used to sign in.
 */
export function BillingEmailVerification({ org }: { org: Organization }) {
  const queryClient = useQueryClient();
  // A new billing email that waits for its code while the verified one stays the sign-in email.
  const pending = org.pending_billing_email ?? null;
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => organizationsAPI.startBillingEmailVerification(),
    onSuccess: (result) => {
      if (result.status === 'verified') {
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(org.id) });
        return;
      }
      setCodeSentTo(result.email_sent_to ?? pending ?? org.billing_email ?? '');
      toast.success('Confirmation code sent');
    },
    onError: (error) => {
      toast.error('Could not send the confirmation code', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (value: string) => organizationsAPI.verifyBillingEmail(value),
    onSuccess: () => {
      toast.success('Billing email confirmed');
      setCodeSentTo(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(org.id) });
    },
    onError: (error) => {
      toast.error('Could not confirm the billing email', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  if (!org.billing_email && !pending) return null;

  if (!pending && org.billing_email_verified_at) {
    return (
      <Badge variant="outline" className="mt-1" data-testid="billing-email-verified">
        Confirmed
      </Badge>
    );
  }

  const trimmed = code.trim();
  return (
    <div className="mt-2 space-y-2" data-testid="billing-email-unverified">
      {pending ? (
        <p className="text-sm text-muted-foreground" data-testid="billing-email-pending">
          {org.billing_email_verified_at && org.billing_email ? (
            <>
              <Badge variant="outline" className="mr-2" data-testid="billing-email-verified">
                Confirmed
              </Badge>
              {org.billing_email} stays your sign-in email until{' '}
            </>
          ) : (
            <>Email sign-in starts working once </>
          )}
          <strong>{pending}</strong> is confirmed with the code we send there.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Not confirmed yet. Email sign-in with this address starts working once you confirm it with
          the code we send there.
        </p>
      )}
      {codeSentTo === null ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending}
        >
          {sendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send confirmation code
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{6}$/.test(trimmed)) verifyMutation.mutate(trimmed);
          }}
        >
          <Input
            aria-label="Confirmation code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-36 font-mono"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!/^\d{6}$/.test(trimmed) || verifyMutation.isPending}
          >
            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
          <span className="text-xs text-muted-foreground">Sent to {codeSentTo}</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              setCode('');
              sendMutation.mutate();
            }}
            disabled={sendMutation.isPending}
          >
            Send a new code
          </Button>
        </form>
      )}
    </div>
  );
}

export function WebhookTokenSection({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);

  const { data: webhookData, isLoading } = useQuery({
    queryKey: ['webhook-token', orgId],
    queryFn: () => organizationsAPI.getWebhookToken(),
    enabled: !!orgId,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => organizationsAPI.regenerateWebhookToken(),
    onSuccess: () => {
      toast.success('Webhook token regenerated');
      queryClient.invalidateQueries({ queryKey: ['webhook-token', orgId] });
      setShowToken(true);
    },
    onError: (error) => {
      toast.error('Failed to regenerate webhook token', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    if (await copyText(text)) {
      toast.success(`${label} copied to clipboard`);
    } else {
      toast.error(`Could not copy the ${label.toLowerCase()}`, {
        description: 'Select the text and copy it manually.',
      });
    }
  };

  const maskedToken = webhookData?.webhook_token
    ? webhookData.webhook_token.substring(0, 8) + '••••••••••••••••••••••••'
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Incoming Webhooks
        </CardTitle>
        <CardDescription>
          Configure authentication for external services to send webhooks to your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookData?.webhook_url || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy webhook URL"
                  onClick={() => copyToClipboard(webhookData?.webhook_url || '', 'Webhook URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in your external service to send events to Spooled
              </p>
            </div>

            {/* Webhook Token */}
            <div className="space-y-2">
              <Label>Webhook Token</Label>
              {webhookData?.webhook_token ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={showToken ? webhookData.webhook_token : maskedToken || ''}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy webhook token"
                      onClick={() => copyToClipboard(webhookData.webhook_token!, 'Webhook token')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Include this token in the{' '}
                    <code className="rounded bg-muted px-1">X-Webhook-Token</code> header when
                    sending webhooks.{' '}
                    <a
                      href="/settings/webhooks#incoming-webhook-log"
                      className="underline hover:text-primary"
                    >
                      See the incoming webhook log
                    </a>
                    .
                  </p>
                </>
              ) : (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    ⚠️ No webhook token configured. Incoming webhooks are blocked until you
                    regenerate a token.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={regenerateMutation.isPending}>
                    {regenerateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Regenerate Token
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Webhook Token?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will generate a new token and invalidate the current one. Any external
                      services using the old token will need to be updated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => regenerateMutation.mutate()}>
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * What the delete-organization request needs, in words. The backend decides; this only
 * turns its refusals into something that says what to do next.
 */
export function describeDeleteOrganizationError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 403) {
      return 'Only an unrestricted API key can delete the organization. Sign in with one and try again.';
    }
    if (error.status === 404) {
      return 'This organization no longer exists, or is not the one your key belongs to.';
    }
    // 409: still has active jobs, workers or schedules, or the subscription could not be
    // canceled. The message names which and how many.
    return error.message;
  }
  return error instanceof Error ? error.message : 'The organization could not be deleted.';
}

/**
 * Delete the organization, behind a typed confirmation. Shown to unrestricted keys only; the
 * backend refuses everyone else with 403. Success ends the session: the organization's keys
 * stop working at once.
 */
export function DeleteOrganizationSection({ org }: { org: Organization }) {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmText = org.slug || org.name;

  const deleteMutation = useMutation({
    mutationFn: () => organizationsAPI.delete(org.id),
    onSuccess: () => {
      toast.success('Organization deleted', { description: 'You have been signed out.' });
      setOpen(false);
      queryClient.clear();
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    },
    onError: (err) => {
      // Close the dialog so the reason, which can be long, stays readable on the page.
      setOpen(false);
      setError(describeDeleteOrganizationError(err));
    },
  });

  return (
    <Card className="border-destructive/50" data-testid="delete-organization">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete organization
        </CardTitle>
        <CardDescription>
          Permanently deletes <strong>{org.name}</strong> with its jobs, queues, schedules, API keys
          and webhooks. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Nothing is deleted while the organization has active jobs (pending, scheduled or
            processing), registered workers that are not offline, or active schedules. Cancel the
            jobs, deregister the workers and pause or delete the schedules first.
          </li>
          <li>
            A paid subscription is canceled first. If Stripe cannot cancel it, nothing is deleted
            and you can try again.
          </li>
          <li>Every API key of the organization stops working, and you are signed out.</li>
        </ul>

        {error && (
          <Alert variant="destructive" data-testid="delete-organization-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          variant="destructive"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete organization
        </Button>
      </CardContent>

      <DangerConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete organization"
        description={
          <>
            This permanently deletes <strong>{org.name}</strong> and everything in it.
          </>
        }
        confirmText={confirmText}
        confirmLabel="Delete organization"
        isLoading={deleteMutation.isPending}
        warnings={[
          'All jobs, queues, schedules, workflows and webhooks are deleted',
          'All API keys stop working and you are signed out',
          'Refused while active jobs, workers or schedules exist',
        ]}
      />
    </Card>
  );
}

function OrganizationSettingsContent() {
  const queryClient = useQueryClient();
  const currentOrganization = useAuthStore((s) => s.currentOrganization);
  const accessToken = useAuthStore((s) => s.accessToken);
  const keyQueues = useAuthStore((s) => s.user?.queues);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const orgId = currentOrganization?.id;

  // If we have a valid session but the organization context wasn't restored
  // (e.g. older login persisted before this code shipped, or the original
  // fetchCurrentUser call failed silently), reload it instead of showing a
  // dead-end "No organization selected" screen.
  useEffect(() => {
    if (accessToken && !currentOrganization) {
      fetchCurrentUser();
    }
  }, [accessToken, currentOrganization, fetchCurrentUser]);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: queryKeys.organizations.detail(orgId || ''),
    queryFn: () => organizationsAPI.get(orgId!),
    enabled: !!orgId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.organizations.members(orgId || ''),
    queryFn: () => organizationsAPI.getMembers(orgId!),
    enabled: !!orgId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationRequest) => organizationsAPI.update(orgId!, data),
    onSuccess: (updated) => {
      toast.success('Organization updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(orgId!) });
      // The header reads the persisted currentOrganization, and hydration does not
      // refetch it while that object is set. Write the renamed organization now.
      useAuthStore.setState({
        currentOrganization: updated,
        organizations: [updated],
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error('Failed to update organization', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    },
  });

  const handleEdit = () => {
    if (org) {
      setName(org.name);
      setDescription(org.description ?? '');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim(),
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName('');
    setDescription('');
  };

  if (!orgId) {
    // Authenticated but org context not yet loaded — show a loading state while
    // the effect above refetches it. If the user has no token at all, AuthGuard
    // will already have redirected to login, so we should never render the
    // "no organization" copy in normal flows.
    if (accessToken) {
      return (
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }

    return (
      <div className="p-8 text-center text-muted-foreground">
        <Building className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="mb-1 text-lg font-medium">No organization selected</p>
        <p className="text-sm">Please select an organization to view settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground">Organization details and who can access it</p>
      </div>

      {/* Organization Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {orgLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : org ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="org-name">Organization Name</Label>
                {isEditing ? (
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Organization name"
                  />
                ) : (
                  <p className="text-sm font-medium">{org.name}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="org-description">Description</Label>
                {isEditing ? (
                  <Textarea
                    id="org-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {org.description?.trim() ? org.description : 'No description set'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p className="font-mono text-sm">{org.slug}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plan</Label>
                  <Badge variant="outline" className="mt-1">
                    {org.plan_tier.charAt(0).toUpperCase() + org.plan_tier.slice(1)}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing Email</Label>
                  <p className="text-sm font-medium">{org.billing_email || 'Not set'}</p>
                  {org.pending_billing_email && (
                    <p className="text-xs text-muted-foreground">
                      Pending confirmation: {org.pending_billing_email}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatRelativeTime(org.created_at)}</p>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Usage & Limits */}
      <UsageWidget />

      {/* Members */}
      {/* Access. Spooled has no per-person user accounts: the members endpoint
          returns the org's active API keys, and listing them here as "people"
          showed key names like "Initial Admin Key" as members. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Access
          </CardTitle>
          <CardDescription>
            Spooled has no per-person accounts. Signing in to the dashboard uses an email code sent
            to the billing email; everything else authenticates with an API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Sign-in email</p>
            <p className="text-sm font-medium">{org?.billing_email || 'Not set'}</p>
            {org && <BillingEmailVerification org={org} />}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Active API keys</p>
              {membersLoading ? (
                <Skeleton className="mt-1 h-5 w-10" />
              ) : (
                <p className="text-sm font-medium" data-testid="active-api-key-count">
                  {members?.length ?? 0}
                </p>
              )}
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/settings/api-keys">Manage API keys</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incoming Webhooks */}
      <WebhookTokenSection orgId={orgId} />

      {/* Danger zone: unrestricted keys only (the backend refuses everyone else) */}
      {org && isUnrestrictedKey(keyQueues) && <DeleteOrganizationSection org={org} />}
    </div>
  );
}

export function OrganizationSettingsPage() {
  return (
    <ProtectedPage>
      <OrganizationSettingsContent />
    </ProtectedPage>
  );
}
