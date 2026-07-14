import { ProtectedPage } from '@/components/providers/ProtectedPage';
import { Building, ChevronRight, CreditCard, Key, User, Webhook } from 'lucide-react';

interface SettingsLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function SettingsLink({ href, icon, title, description }: SettingsLinkProps) {
  return (
    <a
      href={href}
      className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

interface SettingsGroupProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <section aria-labelledby={`settings-group-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-2">
        <h2
          id={`settings-group-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
        {children}
      </div>
    </section>
  );
}

function SettingsContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Organization, access credentials, session details, and billing
        </p>
      </div>

      <SettingsGroup title="Organization" description="Workspace identity, members, and usage">
        <SettingsLink
          href="/settings/organization"
          icon={<Building className="h-4 w-4" />}
          title="Organization"
          description="Name, slug, members, and webhook signing token"
        />
      </SettingsGroup>

      <SettingsGroup title="Access" description="Credentials and outbound integrations">
        <SettingsLink
          href="/settings/api-keys"
          icon={<Key className="h-4 w-4" />}
          title="API Keys"
          description="Create, rotate, and revoke keys for programmatic access"
        />
        <SettingsLink
          href="/settings/webhooks"
          icon={<Webhook className="h-4 w-4" />}
          title="Webhooks"
          description="Endpoint URLs and delivery history for event notifications"
        />
      </SettingsGroup>

      <SettingsGroup
        title="Session & profile"
        description="Read-only details for your current sign-in"
      >
        <SettingsLink
          href="/settings/profile"
          icon={<User className="h-4 w-4" />}
          title="Session"
          description="Organization context, API key ID, and token expiry"
        />
      </SettingsGroup>

      <SettingsGroup title="Billing" description="Subscription plan and payment management">
        <SettingsLink
          href="/settings/billing"
          icon={<CreditCard className="h-4 w-4" />}
          title="Billing"
          description="Current plan, usage limits, and Stripe customer portal"
        />
      </SettingsGroup>
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
