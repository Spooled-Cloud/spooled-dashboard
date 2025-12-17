import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Layers,
  Users,
  Key,
  Clock,
  GitBranch,
  Bell,
  Zap,
} from 'lucide-react';
import { usageAPI, type UsageInfo, type UsageItem } from '@/lib/api/usage';

interface UsageWidgetProps {
  /** Show compact version for sidebar/header */
  compact?: boolean;
  /** Show upgrade prompt */
  showUpgrade?: boolean;
}

export function UsageWidget({ compact = false, showUpgrade = true }: UsageWidgetProps) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const data = await usageAPI.getUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return compact ? (
      <Skeleton className="h-8 w-32" />
    ) : (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !usage) {
    return null; // Silently fail - usage widget is not critical
  }

  // Compact version for header/sidebar
  if (compact) {
    const hasWarnings = usage.warnings.length > 0;
    const criticalCount = usage.warnings.filter((w) => w.severity === 'critical').length;

    return (
      <div className="flex items-center gap-2">
        <Badge
          variant={usage.plan === 'free' ? 'outline' : 'secondary'}
          className={usage.plan === 'free' ? 'border-amber-500 text-amber-600' : ''}
        >
          {usage.plan_display_name}
        </Badge>
        {hasWarnings && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount > 0
              ? `${criticalCount} limit${criticalCount > 1 ? 's' : ''}`
              : 'Warning'}
          </Badge>
        )}
      </div>
    );
  }

  const isFree = usage.plan === 'free';

  return (
    <Card className={isFree ? 'border-amber-500/30' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage & Limits
            </CardTitle>
            <CardDescription>Your {usage.plan_display_name} plan resource usage</CardDescription>
          </div>
          <Badge
            variant={isFree ? 'outline' : 'secondary'}
            className={isFree ? 'border-amber-500 text-amber-600' : ''}
          >
            {usage.plan_display_name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warnings */}
        {usage.warnings.length > 0 && (
          <div className="space-y-2">
            {usage.warnings.map((warning, i) => (
              <Alert
                key={i}
                variant={warning.severity === 'critical' ? 'destructive' : 'default'}
                className={
                  warning.severity === 'warning'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                    : ''
                }
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{warning.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Usage Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <UsageBar
            label="Jobs Today"
            icon={<Briefcase className="h-4 w-4" />}
            usage={usage.usage.jobs_today}
            isFree={isFree}
          />
          <UsageBar
            label="Active Jobs"
            icon={<Briefcase className="h-4 w-4" />}
            usage={usage.usage.active_jobs}
            isFree={isFree}
          />
          <UsageBar
            label="Queues"
            icon={<Layers className="h-4 w-4" />}
            usage={usage.usage.queues}
            isFree={isFree}
          />
          <UsageBar
            label="Workers"
            icon={<Users className="h-4 w-4" />}
            usage={usage.usage.workers}
            isFree={isFree}
          />
          <UsageBar
            label="API Keys"
            icon={<Key className="h-4 w-4" />}
            usage={usage.usage.api_keys}
            isFree={isFree}
          />
          <UsageBar
            label="Schedules"
            icon={<Clock className="h-4 w-4" />}
            usage={usage.usage.schedules}
            isFree={isFree}
          />
          <UsageBar
            label="Workflows"
            icon={<GitBranch className="h-4 w-4" />}
            usage={usage.usage.workflows}
            isFree={isFree}
          />
          <UsageBar
            label="Webhooks"
            icon={<Bell className="h-4 w-4" />}
            usage={usage.usage.webhooks}
            isFree={isFree}
          />
        </div>

        {/* Plan Details */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Max Payload Size</span>
              <p className="font-medium">{formatBytes(usage.limits.max_payload_size_bytes)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Rate Limit</span>
              <p className="font-medium">{usage.limits.rate_limit_requests_per_second}/sec</p>
            </div>
            <div>
              <span className="text-muted-foreground">Job Retention</span>
              <p className="font-medium">{usage.limits.job_retention_days} days</p>
            </div>
            <div>
              <span className="text-muted-foreground">History Retention</span>
              <p className="font-medium">{usage.limits.history_retention_days} days</p>
            </div>
          </div>
        </div>

        {/* Upgrade Prompt */}
        {showUpgrade && isFree && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Unlock more with Starter
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  10x more jobs, workflows, and dedicated support
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
                asChild
              >
                <a href="/settings/billing">
                  Upgrade
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UsageBarProps {
  label: string;
  icon: React.ReactNode;
  usage: UsageItem;
  isFree: boolean;
}

function UsageBar({ label, icon, usage, isFree }: UsageBarProps) {
  if (usage.is_disabled) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span>{label}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Upgrade to unlock
          </Badge>
        </div>
        <Progress value={0} className="h-2 bg-muted/50" />
      </div>
    );
  }

  const percentage = usage.percentage ?? 0;
  // Free tier warns at 50%, others at 80%
  const warningThreshold = isFree ? 50 : 80;
  const isWarning = percentage >= warningThreshold && percentage < 100;
  const isCritical = percentage >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span
          className={
            isCritical ? 'font-medium text-red-600' : isWarning ? 'font-medium text-amber-600' : ''
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

