import { useCallback, useEffect, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  Plus,
  Copy,
  Check,
  RotateCcw,
  Settings2,
  X,
  InfinityIcon,
} from 'lucide-react';
import {
  adminAPI,
  isAdminAuthenticated,
  type AdminOrganizationDetail as OrgDetail,
  type CreateApiKeyResponse,
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

  // API Key creation state
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<CreateApiKeyResponse | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Usage reset state
  const [isResettingUsage, setIsResettingUsage] = useState(false);
  const [usageResetSuccess, setUsageResetSuccess] = useState(false);

  // Custom limits state
  const [customLimitsOpen, setCustomLimitsOpen] = useState(false);
  const [editingLimits, setEditingLimits] = useState<Record<string, string>>({});
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState(false);

  const loadOrganization = useCallback(async () => {
    try {
      const data = await adminAPI.getOrganization(orgId);
      setOrg(data);
      setSelectedPlan(data.plan_tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }
    loadOrganization();
  }, [loadOrganization]);

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

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKeyName.trim()) return;

    setCreatingApiKey(true);
    setError('');
    try {
      const key = await adminAPI.createApiKey(orgId, { name: newApiKeyName.trim() });
      setCreatedApiKey(key);
      // Reload org to update API key count
      loadOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (createdApiKey?.key) {
      await navigator.clipboard.writeText(createdApiKey.key);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  const handleCloseApiKeyDialog = () => {
    setApiKeyDialogOpen(false);
    setNewApiKeyName('');
    setCreatedApiKey(null);
    setApiKeyCopied(false);
  };

  const handleResetUsage = async () => {
    setIsResettingUsage(true);
    setError('');
    try {
      await adminAPI.resetUsage(orgId);
      setUsageResetSuccess(true);
      setTimeout(() => setUsageResetSuccess(false), 3000);
      // Reload to show updated usage
      loadOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset usage');
    } finally {
      setIsResettingUsage(false);
    }
  };

  const handleOpenCustomLimits = () => {
    if (!org) return;
    // Initialize editing limits from current custom_limits or empty
    const current = org.custom_limits || {};
    const limits: Record<string, string> = {};
    const limitFields = [
      'max_jobs_per_day',
      'max_active_jobs',
      'max_queues',
      'max_workers',
      'max_api_keys',
      'max_schedules',
      'max_workflows',
      'max_webhooks',
      'max_payload_size_bytes',
      'rate_limit_requests_per_second',
    ];
    for (const field of limitFields) {
      const value = (current as Record<string, number | null>)[field];
      limits[field] = value !== undefined && value !== null ? String(value) : '';
    }
    setEditingLimits(limits);
    setCustomLimitsOpen(true);
  };

  const handleSaveCustomLimits = async () => {
    if (!org) return;

    setSavingLimits(true);
    setError('');
    try {
      // Build custom_limits object - only include non-empty values
      const customLimits: Record<string, number | null> = {};
      for (const [key, value] of Object.entries(editingLimits)) {
        if (value.trim() !== '') {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num >= 0) {
            customLimits[key] = num;
          }
        }
      }

      // If all fields are empty, set to null to reset to plan defaults
      const limitsToSave = Object.keys(customLimits).length === 0 ? null : customLimits;

      await adminAPI.updateOrganization(orgId, { custom_limits: limitsToSave });
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
      setCustomLimitsOpen(false);
      loadOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update custom limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!org) return;

    setSavingLimits(true);
    setError('');
    try {
      await adminAPI.updateOrganization(orgId, { custom_limits: null });
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
      setCustomLimitsOpen(false);
      loadOrganization();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset limits');
    } finally {
      setSavingLimits(false);
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

      {limitsSuccess && (
        <Alert className="border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Custom limits updated successfully</AlertDescription>
        </Alert>
      )}

      {usageResetSuccess && (
        <Alert className="border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Usage counters reset successfully</AlertDescription>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">API Keys:</span>
                  <span className="font-semibold">{org.api_keys_count}</span>
                </div>
                <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-3 w-3" />
                      Create Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    {!createdApiKey ? (
                      <>
                        <DialogHeader>
                          <DialogTitle>Create API Key</DialogTitle>
                          <DialogDescription>Create a new API key for {org.name}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateApiKey} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="key_name">Key Name</Label>
                            <Input
                              id="key_name"
                              value={newApiKeyName}
                              onChange={(e) => setNewApiKeyName(e.target.value)}
                              placeholder="Production API Key"
                              required
                              maxLength={100}
                            />
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCloseApiKeyDialog}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" disabled={creatingApiKey}>
                              {creatingApiKey ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Key className="mr-2 h-4 w-4" />
                              )}
                              Create Key
                            </Button>
                          </DialogFooter>
                        </form>
                      </>
                    ) : (
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" />
                            API Key Created
                          </DialogTitle>
                          <DialogDescription>
                            Copy this key now - it won't be shown again!
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-700 dark:text-amber-400">
                              This key will only be shown once. Copy it now!
                            </AlertDescription>
                          </Alert>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-xs">
                              {createdApiKey.key}
                            </code>
                            <Button variant="outline" size="icon" onClick={handleCopyApiKey}>
                              {apiKeyCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleCloseApiKeyDialog}>Done</Button>
                        </DialogFooter>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
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

      {/* Custom Limits */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Custom Limits
            </CardTitle>
            <CardDescription>
              Override plan defaults for this organization. Empty values use plan defaults.
            </CardDescription>
          </div>
          <Dialog open={customLimitsOpen} onOpenChange={setCustomLimitsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleOpenCustomLimits}>
                <Settings2 className="mr-2 h-4 w-4" />
                Edit Limits
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Custom Limits for {org.name}</DialogTitle>
                <DialogDescription>
                  Override plan defaults. Leave empty to use the {org.plan_tier} plan defaults. Set
                  to 0 to disable a feature.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="max_jobs_per_day">Max Jobs Per Day</Label>
                  <Input
                    id="max_jobs_per_day"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_jobs_per_day ?? 'Unlimited')}
                    value={editingLimits.max_jobs_per_day || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_jobs_per_day: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_active_jobs">Max Active Jobs</Label>
                  <Input
                    id="max_active_jobs"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_active_jobs ?? 'Unlimited')}
                    value={editingLimits.max_active_jobs || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_active_jobs: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_queues">Max Queues</Label>
                  <Input
                    id="max_queues"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_queues ?? 'Unlimited')}
                    value={editingLimits.max_queues || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_queues: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_workers">Max Workers</Label>
                  <Input
                    id="max_workers"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_workers ?? 'Unlimited')}
                    value={editingLimits.max_workers || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_workers: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_api_keys">Max API Keys</Label>
                  <Input
                    id="max_api_keys"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_api_keys ?? 'Unlimited')}
                    value={editingLimits.max_api_keys || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_api_keys: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_schedules">Max Schedules</Label>
                  <Input
                    id="max_schedules"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_schedules ?? 'Unlimited')}
                    value={editingLimits.max_schedules || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_schedules: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_workflows">Max Workflows</Label>
                  <Input
                    id="max_workflows"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_workflows ?? 'Unlimited')}
                    value={editingLimits.max_workflows || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_workflows: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_webhooks">Max Webhooks</Label>
                  <Input
                    id="max_webhooks"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_webhooks ?? 'Unlimited')}
                    value={editingLimits.max_webhooks || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_webhooks: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_payload_size_bytes">Max Payload Size (bytes)</Label>
                  <Input
                    id="max_payload_size_bytes"
                    type="number"
                    placeholder={String(org.usage_info.limits.max_payload_size_bytes)}
                    value={editingLimits.max_payload_size_bytes || ''}
                    onChange={(e) =>
                      setEditingLimits({ ...editingLimits, max_payload_size_bytes: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_limit_requests_per_second">Rate Limit (req/s)</Label>
                  <Input
                    id="rate_limit_requests_per_second"
                    type="number"
                    placeholder={String(org.usage_info.limits.rate_limit_requests_per_second)}
                    value={editingLimits.rate_limit_requests_per_second || ''}
                    onChange={(e) =>
                      setEditingLimits({
                        ...editingLimits,
                        rate_limit_requests_per_second: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleResetToDefaults}
                  disabled={savingLimits}
                  className="w-full sm:w-auto"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reset to Defaults
                </Button>
                <div className="flex flex-1 justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCustomLimitsOpen(false)}
                    disabled={savingLimits}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveCustomLimits} disabled={savingLimits}>
                    {savingLimits ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Limits
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {org.custom_limits && Object.keys(org.custom_limits).length > 0 ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="mb-3 text-sm font-medium">Active Custom Overrides:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-4">
                {Object.entries(org.custom_limits).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded bg-background px-3 py-2"
                  >
                    <span className="text-muted-foreground">
                      {key.replace(/_/g, ' ').replace(/max /i, '')}
                    </span>
                    <span className="font-mono font-medium">
                      {value === null ? (
                        <InfinityIcon className="h-4 w-4" />
                      ) : (
                        value.toLocaleString()
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Using default {org.plan_tier} plan limits
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>
              Current usage against {org.usage_info.plan_display_name} plan limits
            </CardDescription>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isResettingUsage}>
                {isResettingUsage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset Daily Usage
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Usage Counters?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the daily job counter to 0. This is useful if an organization hit
                  their daily limit and you want to give them more capacity.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetUsage}>Reset Usage</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
