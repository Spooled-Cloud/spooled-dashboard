import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Card, CardContent } from '@/components/ui/card';
import { Key, Webhook, Building, User, ChevronRight, Shield, Bell } from 'lucide-react';

interface SettingsLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function SettingsLink({ href, icon, title, description }: SettingsLinkProps) {
  return (
    <a href={href} className="block">
      <Card className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and organization settings</p>
      </div>

      {/* Account Settings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Account</h2>
        <div className="grid gap-3">
          <SettingsLink
            href="/settings/profile"
            icon={<User className="h-5 w-5" />}
            title="Profile"
            description="Manage your personal account settings and preferences"
          />
        </div>
      </div>

      {/* Organization Settings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Organization</h2>
        <div className="grid gap-3">
          <SettingsLink
            href="/settings/organization"
            icon={<Building className="h-5 w-5" />}
            title="Organization"
            description="Manage organization details and members"
          />
          <SettingsLink
            href="/settings/api-keys"
            icon={<Key className="h-5 w-5" />}
            title="API Keys"
            description="Create and manage API keys for programmatic access"
          />
          <SettingsLink
            href="/settings/webhooks"
            icon={<Webhook className="h-5 w-5" />}
            title="Webhooks"
            description="Configure webhook endpoints for real-time notifications"
          />
        </div>
      </div>

      {/* Security */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-muted-foreground">Security</h2>
        <div className="grid gap-3">
          <Card className="opacity-60">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Security Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Two-factor authentication, sessions, and more
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Coming Soon</span>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure email and in-app notifications
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Coming Soon</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <ProtectedPage>
      <SettingsContent />
    </ProtectedPage>
  );
}
