import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils/format';
import { Key, Clock, LogOut, Shield, Building2 } from 'lucide-react';
import { toast } from 'sonner';

function ProfileSettingsContent() {
  const { user, logout } = useAuthStore();

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
        <p className="text-sm">Please sign in to view your session info</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session Info</h1>
        <p className="text-muted-foreground">Your current API key session details</p>
      </div>

      {/* Session Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Current Session
          </CardTitle>
          <CardDescription>Details about your authenticated session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                Organization ID
              </Label>
              <p className="mt-1 font-mono text-sm">{user.organization_id}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Key className="h-3 w-3" />
                API Key ID
              </Label>
              <p className="mt-1 font-mono text-sm">{user.api_key_id}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Session Started
              </Label>
              <p className="mt-1 text-sm">{formatRelativeTime(user.issued_at)}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Session Expires
              </Label>
              <p className="mt-1 text-sm">{formatRelativeTime(user.expires_at)}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="flex items-center gap-1 text-muted-foreground">
              <Shield className="h-3 w-3" />
              Queue Access
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.queues.length === 0 ? (
                <span className="text-sm text-muted-foreground">No queue restrictions</span>
              ) : user.queues.includes('*') ? (
                <Badge variant="secondary">All Queues</Badge>
              ) : (
                user.queues.map((queue) => (
                  <Badge key={queue} variant="outline">
                    {queue}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>Manage your API keys for programmatic access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Create and manage API keys for your organization
            </p>
            <Button variant="outline" asChild>
              <a href="/settings/api-keys">Manage API Keys</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            Sign Out
          </CardTitle>
          <CardDescription>End your current session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">End Session</p>
              <p className="text-xs text-muted-foreground">
                Sign out and return to the login page
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
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
