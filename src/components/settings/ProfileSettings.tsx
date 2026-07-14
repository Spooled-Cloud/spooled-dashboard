import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth';
import { getPlanDisplayName } from '@/lib/api/billing';
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format';
import { Key, Clock, LogOut, Shield, Building2, Info } from 'lucide-react';
import { toast } from 'sonner';

function SessionDetail({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function ProfileSettingsContent() {
  const { user, currentOrganization, expiresAt, logout } = useAuthStore();

  const handleLogout = () => {
    toast.promise(logout(), {
      loading: 'Signing out...',
      success: 'Signed out successfully',
      error: 'Failed to sign out',
    });
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Key className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="mb-1 text-lg font-medium">Not signed in</p>
        <p className="text-sm">Sign in with an API key to view session details</p>
      </div>
    );
  }

  const orgName = currentOrganization?.name;
  const planTier = currentOrganization?.plan_tier;
  const accessTokenExpiry = expiresAt != null ? new Date(expiresAt) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session</h1>
        <p className="text-muted-foreground">
          Read-only context for your API key sign-in — profile fields are not editable
        </p>
      </div>

      <div className="bg-muted/30 flex gap-3 rounded-sm border border-border px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          The dashboard authenticates with an organization API key. There is no separate user
          profile to edit; update organization details under{' '}
          <a
            href="/settings/organization"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Organization settings
          </a>
          .
        </p>
      </div>

      <div className="overflow-hidden rounded-sm border border-border">
        <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Current session
        </div>
        <div className="divide-y divide-border px-4 py-4">
          <div className="grid gap-4 pb-4 sm:grid-cols-2">
            <SessionDetail label="Organization" icon={<Building2 className="h-3 w-3" />}>
              {orgName ? (
                <p className="font-medium">{orgName}</p>
              ) : (
                <p className="font-mono text-muted-foreground">{user.organization_id}</p>
              )}
              {orgName && (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {user.organization_id}
                </p>
              )}
            </SessionDetail>

            {planTier && (
              <SessionDetail label="Plan" icon={<Shield className="h-3 w-3" />}>
                <Badge variant="secondary">{getPlanDisplayName(planTier)}</Badge>
              </SessionDetail>
            )}

            <SessionDetail label="API key ID" icon={<Key className="h-3 w-3" />}>
              <p className="font-mono">{user.api_key_id}</p>
            </SessionDetail>

            <SessionDetail label="Session started" icon={<Clock className="h-3 w-3" />}>
              <p>{formatRelativeTime(user.issued_at)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(user.issued_at)}</p>
            </SessionDetail>

            <SessionDetail label="Session expires" icon={<Clock className="h-3 w-3" />}>
              <p>{formatRelativeTime(user.expires_at)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(user.expires_at)}</p>
            </SessionDetail>

            {accessTokenExpiry && (
              <SessionDetail label="Access token expires" icon={<Clock className="h-3 w-3" />}>
                <p>{formatRelativeTime(accessTokenExpiry)}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(accessTokenExpiry)}</p>
              </SessionDetail>
            )}
          </div>

          <div className="pt-4">
            <SessionDetail label="Queue access" icon={<Shield className="h-3 w-3" />}>
              <div className="mt-1 flex flex-wrap gap-2">
                {user.queues.length === 0 ? (
                  <span className="text-muted-foreground">No queue restrictions</span>
                ) : user.queues.includes('*') ? (
                  <Badge variant="secondary">All queues</Badge>
                ) : (
                  user.queues.map((queue) => (
                    <Badge key={queue} variant="outline">
                      {queue}
                    </Badge>
                  ))
                )}
              </div>
            </SessionDetail>
          </div>
        </div>
      </div>

      <div className="border-destructive/40 overflow-hidden rounded-sm border">
        <div className="border-destructive/30 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-destructive">
          Sign out
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm font-medium">End session</p>
            <p className="text-xs text-muted-foreground">
              Clears local tokens and returns to the login page
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  return (
    <ProtectedPage>
      <ProfileSettingsContent />
    </ProtectedPage>
  );
}
