import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { InlineError } from '@/components/ui/inline-error';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Briefcase,
  Users,
  Activity,
  TrendingUp,
  Shield,
  LogOut,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { adminAPI, clearAdminKey, isAdminAuthenticated, type PlatformStats } from '@/lib/api/admin';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-red-500/10 text-red-600',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <p className="flex items-center gap-1 text-xs">
                <span className={trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </p>
            )}
          </div>
          <div className={`rounded-lg p-2.5 ${variantStyles[variant]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }

    loadStats();
  }, []);

  const loadStats = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load stats'));
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <InlineError title="Error Loading Dashboard" error={error} onRetry={loadStats} />
      </div>
    );
  }

  const failureRate = stats?.jobs.completed_24h
    ? ((stats.jobs.failed_24h / stats.jobs.completed_24h) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title="Admin Dashboard"
        description="Platform management and monitoring"
        actions={
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        }
      >
        <Badge variant="outline" className="mt-2 w-fit border-amber-500 text-amber-600">
          <Shield className="mr-1.5 h-3 w-3" />
          Admin Access
        </Badge>
      </PageHeader>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value={stats?.organizations.total ?? 0}
          subtitle={`+${stats?.organizations.created_today ?? 0} today`}
          icon={<Building2 className="h-5 w-5" />}
          trend={{ value: stats?.organizations.created_today ?? 0, label: 'today' }}
        />
        <StatCard
          title="Active Jobs"
          value={(stats?.jobs.pending ?? 0) + (stats?.jobs.processing ?? 0)}
          subtitle={`${stats?.jobs.processing ?? 0} processing`}
          icon={<Briefcase className="h-5 w-5" />}
        />
        <StatCard
          title="Workers"
          value={stats?.workers.total ?? 0}
          subtitle={`${stats?.workers.healthy ?? 0} healthy`}
          icon={<Users className="h-5 w-5" />}
          variant={stats?.workers.healthy === stats?.workers.total ? 'success' : 'warning'}
        />
        <StatCard
          title="24h Throughput"
          value={stats?.jobs.completed_24h?.toLocaleString() ?? 0}
          subtitle={`${failureRate}% failure rate`}
          icon={<Activity className="h-5 w-5" />}
          variant={Number(failureRate) < 5 ? 'success' : 'danger'}
        />
      </div>

      {/* Organizations by Plan & Job Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Organizations by Plan
            </CardTitle>
            <CardDescription>Distribution across plan tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.organizations.by_plan.map((item) => {
                const percentage = Math.round(
                  (item.count / (stats?.organizations.total || 1)) * 100
                );
                return (
                  <div key={item.plan} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            item.plan === 'enterprise'
                              ? 'default'
                              : item.plan === 'pro'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="capitalize"
                        >
                          {item.plan}
                        </Badge>
                      </div>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Job Statistics
            </CardTitle>
            <CardDescription>Current job queue status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">Pending</span>
                </div>
                <span className="text-lg font-semibold">{stats?.jobs.pending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-500/5 p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Processing</span>
                </div>
                <span className="text-lg font-semibold text-blue-600">
                  {stats?.jobs.processing ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Completed (24h)</span>
                </div>
                <span className="text-lg font-semibold text-emerald-600">
                  {stats?.jobs.completed_24h?.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-500/5 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Failed (24h)</span>
                </div>
                <span className="text-lg font-semibold text-red-600">
                  {stats?.jobs.failed_24h?.toLocaleString() ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <CreateOrganizationDialog onSuccess={loadStats} />
            <Button asChild>
              <a href="/admin/organizations">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Organizations
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/admin/plans">View Plan Limits</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
