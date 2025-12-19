import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { InlineError } from '@/components/ui/inline-error';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DataTableContainer,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableCell,
} from '@/components/ui/data-table';
import { motion } from 'framer-motion';
import {
  Shield,
  LogOut,
  Crown,
  Zap,
  Rocket,
  Building2,
  Infinity as InfinityIcon,
  Check,
  X,
} from 'lucide-react';
import { adminAPI, clearAdminKey, isAdminAuthenticated, type PlanLimits } from '@/lib/api/admin';

function formatLimit(value: number | null): string {
  if (value === null) return 'Unlimited';
  return value.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function getPlanIcon(tier: string) {
  switch (tier) {
    case 'free':
      return <Zap className="h-5 w-5" />;
    case 'starter':
      return <Rocket className="h-5 w-5" />;
    case 'pro':
      return <Crown className="h-5 w-5" />;
    case 'enterprise':
      return <Building2 className="h-5 w-5" />;
    default:
      return <Zap className="h-5 w-5" />;
  }
}

function getPlanColor(tier: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (tier) {
    case 'enterprise':
      return 'default';
    case 'pro':
      return 'secondary';
    case 'starter':
      return 'outline';
    default:
      return 'outline';
  }
}

export function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanLimits[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }

    loadPlans();
  }, []);

  const loadPlans = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await adminAPI.getPlans();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load plans'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminKey();
    window.location.href = '/admin/login';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <InlineError
          title="Error Loading Plans"
          error={error}
          onRetry={loadPlans}
        />
      </div>
    );
  }

  const orderedPlans = ['free', 'starter', 'pro', 'enterprise'];
  const sortedPlans = plans?.sort(
    (a, b) => orderedPlans.indexOf(a.tier) - orderedPlans.indexOf(b.tier)
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Plan Limits"
        description="Compare features and limits across all plan tiers"
        backHref="/admin"
        backLabel="Admin Dashboard"
        actions={
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
        }
      >
        <Badge variant="outline" className="mt-2 w-fit border-amber-500 text-amber-600">
          <Shield className="mr-1.5 h-3 w-3" />
          Admin View
        </Badge>
      </PageHeader>

      {/* Plan Cards Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {sortedPlans?.map((plan, idx) => (
          <motion.div
            key={plan.tier}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className={plan.tier === 'pro' ? 'border-primary ring-1 ring-primary/20' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPlanIcon(plan.tier)}
                  <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                </div>
                  <Badge variant={getPlanColor(plan.tier)} className="capitalize">{plan.tier}</Badge>
              </div>
              <CardDescription>
                {plan.tier === 'free' && 'Perfect for testing and small projects'}
                {plan.tier === 'starter' && 'For growing teams and applications'}
                {plan.tier === 'pro' && 'For production workloads'}
                {plan.tier === 'enterprise' && 'For large-scale deployments'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Jobs/day</span>
                  <span className="font-semibold">
                  {plan.max_jobs_per_day === null ? (
                    <InfinityIcon className="inline h-4 w-4" />
                  ) : (
                    formatLimit(plan.max_jobs_per_day)
                  )}
                </span>
              </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Rate limit</span>
                  <span className="font-semibold">{plan.rate_limit_requests_per_second}/s</span>
              </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Retention</span>
                  <span className="font-semibold">{plan.job_retention_days} days</span>
              </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">Workflows</span>
                  <span className="font-semibold">
                  {plan.max_workflows === null ? (
                      <Check className="inline h-4 w-4 text-emerald-500" />
                  ) : plan.max_workflows === 0 ? (
                    <X className="inline h-4 w-4 text-red-500" />
                  ) : (
                    formatLimit(plan.max_workflows)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </div>

      {/* Detailed Comparison Table */}
      <DataTableContainer>
        <CardHeader className="border-b">
          <CardTitle>Detailed Limits Comparison</CardTitle>
          <CardDescription>
            Complete breakdown of all resource limits across plan tiers
          </CardDescription>
        </CardHeader>
        <DataTable>
          <DataTableHeader>
            <tr>
              <DataTableHead className="w-[200px]">Resource</DataTableHead>
                {sortedPlans?.map((plan) => (
                <DataTableHead key={plan.tier} align="center">
                    <div className="flex items-center justify-center gap-1">
                      {getPlanIcon(plan.tier)}
                      <span>{plan.display_name}</span>
                    </div>
                </DataTableHead>
              ))}
            </tr>
          </DataTableHeader>
          <tbody className="divide-y">
            {[
              { key: 'max_jobs_per_day', label: 'Jobs per Day' },
              { key: 'max_active_jobs', label: 'Active Jobs' },
              { key: 'max_queues', label: 'Queues' },
              { key: 'max_workers', label: 'Workers' },
              { key: 'max_api_keys', label: 'API Keys' },
              { key: 'max_schedules', label: 'Schedules' },
              { key: 'max_workflows', label: 'Workflows', special: true },
              { key: 'max_webhooks', label: 'Webhooks' },
              { key: 'max_payload_size_bytes', label: 'Max Payload Size', format: 'bytes' },
              { key: 'rate_limit_requests_per_second', label: 'Rate Limit (req/s)', format: 'number' },
              { key: 'rate_limit_burst', label: 'Rate Limit Burst', format: 'number' },
              { key: 'job_retention_days', label: 'Job Retention', format: 'days' },
              { key: 'history_retention_days', label: 'History Retention', format: 'days' },
            ].map((row) => (
              <DataTableRow key={row.key}>
                <DataTableCell className="font-medium">{row.label}</DataTableCell>
                {sortedPlans?.map((plan) => {
                  const value = (plan as unknown as Record<string, number | null>)[row.key];
                  let displayValue: React.ReactNode;
                  
                  if (row.special && value === 0) {
                    displayValue = <span className="text-muted-foreground">Disabled</span>;
                  } else if (row.format === 'bytes') {
                    displayValue = formatBytes(value as number);
                  } else if (row.format === 'days') {
                    displayValue = `${value} days`;
                  } else if (row.format === 'number') {
                    displayValue = value?.toLocaleString();
                  } else {
                    displayValue = formatLimit(value);
                  }
                  
                  return (
                    <DataTableCell key={plan.tier} align="center">
                      {displayValue}
                    </DataTableCell>
                  );
                })}
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      </DataTableContainer>

      {/* Back Link */}
      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <a href="/admin">Back to Admin Dashboard</a>
        </Button>
      </div>
    </div>
  );
}

