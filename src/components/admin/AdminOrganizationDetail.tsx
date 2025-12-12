import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Building2,
  ArrowLeft,
  Shield,
  AlertTriangle,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  Key,
  Briefcase,
} from 'lucide-react';
import {
  adminAPI,
  isAdminAuthenticated,
  type AdminOrganizationDetail as OrgDetail,
} from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils/format';

interface Props {
  orgId: string;
}

export function AdminOrganizationDetail({ orgId }: Props) {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }
    loadOrganization();
  }, [orgId]);

  const loadOrganization = async () => {
    try {
      const data = await adminAPI.getOrganization(orgId);
      setOrg(data);
      setSelectedPlan(data.plan_tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!org || selectedPlan === org.plan_tier) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await adminAPI.updateOrganization(orgId, { plan_tier: selectedPlan });
      setOrg({ ...org, plan_tier: selectedPlan });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (hardDelete: boolean) => {
    try {
      await adminAPI.deleteOrganization(orgId, hardDelete);
      window.location.href = '/admin/organizations';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Error Loading Organization</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={loadOrganization} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!org) return null;

  const usage = org.usage_info.usage;
  const warnings = org.usage_info.warnings;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="/admin/organizations">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Building2 className="h-8 w-8" />
              {org.name}
            </h1>
            <p className="text-muted-foreground">{org.slug}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          <Shield className="mr-1 h-3 w-3" />
          Admin View
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert className="border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Plan updated successfully</AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, i) => (
            <Alert
              key={i}
              variant={warning.severity === 'critical' ? 'destructive' : 'default'}
              className={warning.severity === 'warning' ? 'border-amber-500' : ''}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">ID</Label>
                <p className="font-mono text-sm">{org.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Slug</Label>
                <p className="font-mono text-sm">{org.slug}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Billing Email</Label>
                <p className="text-sm">{org.billing_email || 'Not set'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="text-sm">{formatRelativeTime(org.created_at)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">API Keys:</span>
                <span className="font-semibold">{org.api_keys_count}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Jobs Created:</span>
                <span className="font-semibold">{org.total_jobs.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Management */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Management</CardTitle>
            <CardDescription>Change the organization's plan tier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Current Plan</Label>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant={
                    org.plan_tier === 'enterprise'
                      ? 'default'
                      : org.plan_tier === 'pro'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="text-base"
                >
                  {org.plan_tier}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Change Plan</Label>
              <div className="mt-1 flex gap-2">
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSavePlan}
                  disabled={isSaving || selectedPlan === org.plan_tier}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Usage</CardTitle>
          <CardDescription>
            Current usage against {org.usage_info.plan_display_name} plan limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <UsageBar label="Jobs Today" usage={usage.jobs_today} />
            <UsageBar label="Active Jobs" usage={usage.active_jobs} />
            <UsageBar label="Queues" usage={usage.queues} />
            <UsageBar label="Workers" usage={usage.workers} />
            <UsageBar label="API Keys" usage={usage.api_keys} />
            <UsageBar label="Schedules" usage={usage.schedules} />
            <UsageBar label="Workflows" usage={usage.workflows} />
            <UsageBar label="Webhooks" usage={usage.webhooks} />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Soft Delete</p>
              <p className="text-sm text-muted-foreground">
                Mark organization as deleted (plan set to "deleted")
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-destructive text-destructive">
                  Soft Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Soft Delete Organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the organization as deleted. The data will remain but the
                    organization will be inaccessible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(false)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Soft Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="font-medium">Permanently Delete</p>
              <p className="text-sm text-muted-foreground">
                Delete organization and ALL associated data (jobs, keys, etc.)
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Forever
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently Delete Organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the organization{' '}
                    <strong>{org.name}</strong> and all associated data including jobs, API keys,
                    workers, and configurations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(true)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Yes, Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface UsageBarProps {
  label: string;
  usage: {
    current: number;
    limit: number | null;
    percentage: number | null;
    is_disabled: boolean;
  };
}

function UsageBar({ label, usage }: UsageBarProps) {
  if (usage.is_disabled) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>{label}</span>
          <Badge variant="outline" className="text-xs">
            Disabled
          </Badge>
        </div>
        <Progress value={0} className="h-2" />
      </div>
    );
  }

  const percentage = usage.percentage ?? 0;
  const isWarning = percentage >= 50 && percentage < 80;
  const isCritical = percentage >= 80;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span
          className={
            isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-muted-foreground'
          }
        >
          {usage.current} / {usage.limit ?? '∞'}
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        className={`h-2 ${
          isCritical ? '[&>div]:bg-red-500' : isWarning ? '[&>div]:bg-amber-500' : ''
        }`}
      />
    </div>
  );
}
