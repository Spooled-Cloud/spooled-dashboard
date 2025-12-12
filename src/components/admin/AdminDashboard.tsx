import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Briefcase,
  Users,
  Activity,
  TrendingUp,
  AlertTriangle,
  Shield,
  LogOut,
} from 'lucide-react';
import { adminAPI, clearAdminKey, isAdminAuthenticated, type PlatformStats } from '@/lib/api/admin';

export function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }

    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
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
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Error Loading Dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={loadStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Shield className="h-8 w-8 text-amber-500" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Platform management and monitoring</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.organizations.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              +{stats?.organizations.created_today ?? 0} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.jobs.total_active ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.jobs.processing ?? 0} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.workers.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.workers.healthy ?? 0} healthy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">24h Completed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.jobs.completed_24h ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.jobs.failed_24h ?? 0} failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Organizations by Plan */}
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
            <div className="space-y-3">
              {stats?.organizations.by_plan.map((item) => (
                <div key={item.plan} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.plan === 'enterprise'
                          ? 'default'
                          : item.plan === 'pro'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {item.plan}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{item.count}</span>
                    <span className="text-sm text-muted-foreground">
                      ({Math.round((item.count / (stats?.organizations.total || 1)) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Job Statistics
            </CardTitle>
            <CardDescription>Current job queue status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-semibold">{stats?.jobs.pending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processing</span>
                <span className="font-semibold">{stats?.jobs.processing ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed (24h)</span>
                <span className="font-semibold text-green-600">
                  {stats?.jobs.completed_24h ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed (24h)</span>
                <span className="font-semibold text-red-600">{stats?.jobs.failed_24h ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
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
