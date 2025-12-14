import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  Shield,
  LogOut,
  AlertTriangle,
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }

    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await adminAPI.getPlans();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Error Loading Plans</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={loadPlans} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const orderedPlans = ['free', 'starter', 'pro', 'enterprise'];
  const sortedPlans = plans?.sort(
    (a, b) => orderedPlans.indexOf(a.tier) - orderedPlans.indexOf(b.tier)
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="/admin">
              <ChevronLeft className="h-5 w-5" />
            </a>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Shield className="h-8 w-8 text-amber-500" />
              Plan Limits
            </h1>
            <p className="text-muted-foreground">
              Compare features and limits across all plan tiers
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      {/* Plan Cards Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {sortedPlans?.map((plan) => (
          <Card key={plan.tier} className={plan.tier === 'pro' ? 'border-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPlanIcon(plan.tier)}
                  <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                </div>
                <Badge variant={getPlanColor(plan.tier)}>{plan.tier}</Badge>
              </div>
              <CardDescription>
                {plan.tier === 'free' && 'Perfect for testing and small projects'}
                {plan.tier === 'starter' && 'For growing teams and applications'}
                {plan.tier === 'pro' && 'For production workloads'}
                {plan.tier === 'enterprise' && 'For large-scale deployments'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Jobs/day</span>
                <span className="font-medium">
                  {plan.max_jobs_per_day === null ? (
                    <InfinityIcon className="inline h-4 w-4" />
                  ) : (
                    formatLimit(plan.max_jobs_per_day)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rate limit</span>
                <span className="font-medium">{plan.rate_limit_requests_per_second}/s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Retention</span>
                <span className="font-medium">{plan.job_retention_days} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workflows</span>
                <span className="font-medium">
                  {plan.max_workflows === null ? (
                    <Check className="inline h-4 w-4 text-green-500" />
                  ) : plan.max_workflows === 0 ? (
                    <X className="inline h-4 w-4 text-red-500" />
                  ) : (
                    formatLimit(plan.max_workflows)
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Limits Comparison</CardTitle>
          <CardDescription>
            Complete breakdown of all resource limits across plan tiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Resource</TableHead>
                {sortedPlans?.map((plan) => (
                  <TableHead key={plan.tier} className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getPlanIcon(plan.tier)}
                      <span>{plan.display_name}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Jobs per Day</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_jobs_per_day)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Active Jobs</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_active_jobs)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Queues</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_queues)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Workers</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_workers)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">API Keys</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_api_keys)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Schedules</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_schedules)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Workflows</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {plan.max_workflows === 0 ? (
                      <span className="text-muted-foreground">Disabled</span>
                    ) : (
                      formatLimit(plan.max_workflows)
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Webhooks</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatLimit(plan.max_webhooks)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Max Payload Size</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {formatBytes(plan.max_payload_size_bytes)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Rate Limit (req/s)</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {plan.rate_limit_requests_per_second}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Rate Limit Burst</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {plan.rate_limit_burst}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Job Retention</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {plan.job_retention_days} days
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">History Retention</TableCell>
                {sortedPlans?.map((plan) => (
                  <TableCell key={plan.tier} className="text-center">
                    {plan.history_retention_days} days
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Back Link */}
      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <a href="/admin">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </a>
        </Button>
      </div>
    </div>
  );
}



