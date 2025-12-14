import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import {
  adminAPI,
  isAdminAuthenticated,
  type AdminOrganization,
  type ListOrgsParams,
} from '@/lib/api/admin';
import { formatRelativeTime } from '@/lib/utils/format';

export function AdminOrganizationsList() {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadOrganizations = useCallback(
    async (searchTerm?: string) => {
      setIsLoading(true);
      try {
        const params: ListOrgsParams = {
          limit,
          offset: page * limit,
          sort_by: 'created_at',
          sort_order: 'desc',
        };
        if (planFilter && planFilter !== 'all') {
          params.plan_tier = planFilter;
        }
        if (searchTerm !== undefined ? searchTerm : search) {
          params.search = searchTerm !== undefined ? searchTerm : search;
        }

        const data = await adminAPI.listOrganizations(params);
        setOrganizations(data.organizations);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    },
    [page, planFilter, search, limit]
  );

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }
    loadOrganizations();
  }, [loadOrganizations]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadOrganizations(search);
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'default';
      case 'pro':
        return 'secondary';
      case 'starter':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <a href="/admin">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Building2 className="h-8 w-8" />
              Organizations
            </h1>
            <p className="text-muted-foreground">{total} total organizations</p>
          </div>
        </div>
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          <Shield className="mr-1 h-3 w-3" />
          Admin View
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={planFilter}
              onValueChange={(v) => {
                setPlanFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : organizations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No organizations found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Jobs Today</TableHead>
                    <TableHead className="text-right">Active Jobs</TableHead>
                    <TableHead className="text-right">Queues</TableHead>
                    <TableHead className="text-right">Workers</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-muted-foreground">{org.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(org.plan_tier)}>{org.plan_tier}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{org.usage.jobs_today}</TableCell>
                      <TableCell className="text-right font-mono">
                        {org.usage.active_jobs}
                      </TableCell>
                      <TableCell className="text-right font-mono">{org.usage.queues}</TableCell>
                      <TableCell className="text-right font-mono">{org.usage.workers}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(org.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/organizations/${org.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



