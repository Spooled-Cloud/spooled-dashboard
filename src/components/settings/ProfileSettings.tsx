import { useState } from 'react';
import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils/format';
import { User, Mail, Shield, Clock, CheckCircle, AlertCircle, LogOut, Key } from 'lucide-react';
import { toast } from 'sonner';

function ProfileSettingsContent() {
  const { user, logout } = useAuthStore();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    // Password change API not yet available
    toast.info('Password change coming soon', {
      description: 'This feature will be available in a future update',
    });
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

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
        <User className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="mb-1 text-lg font-medium">Not signed in</p>
        <p className="text-sm">Please sign in to view your profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your personal account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold">{user.name}</h3>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                Email
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm">{user.email}</p>
                {user.email_verified ? (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Shield className="h-3 w-3" />
                Role
              </Label>
              <Badge variant="outline" className="mt-1">
                {user.role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">Organization</Label>
              <p className="mt-1 text-sm font-medium">{user.organization_name}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last Login
              </Label>
              <p className="mt-1 text-sm">
                {user.last_login_at ? formatRelativeTime(user.last_login_at) : 'N/A'}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-muted-foreground">Two-Factor Authentication</Label>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm">
                {user.two_factor_enabled ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Enabled
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not enabled</span>
                )}
              </p>
              <Button variant="outline" size="sm" disabled>
                {user.two_factor_enabled ? 'Manage' : 'Enable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordChange ? (
            <Button variant="outline" onClick={() => setShowPasswordChange(true)}>
              Change Password
            </Button>
          ) : (
            <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
              {passwordError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Update Password</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Session */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            Session
          </CardTitle>
          <CardDescription>Manage your current session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign Out</p>
              <p className="text-xs text-muted-foreground">
                End your current session and return to the login page
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
