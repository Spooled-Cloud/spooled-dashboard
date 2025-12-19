import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import {
  DataTableContainer,
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableRow,
  DataTableCell,
  DataTableLoading,
  DataTablePagination,
} from '@/components/ui/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Search, Shield, ExternalLink } from 'lucide-react';
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
  const [error, setError] = useState<Error | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadOrganizations = useCallback(
    async (searchTerm?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const params: ListOrgsParams = {
          limit,
          offset: (page - 1) * limit,
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
        setError(err instanceof Error ? err : new Error('Failed to load organizations'));
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
    setPage(1);
    loadOrganizations(search);
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'default' as const;
      case 'pro':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Organizations"
        description={`${total} total organizations`}
        backHref="/admin"
        backLabel="Admin Dashboard"
      >
        <Badge variant="outline" className="mt-2 w-fit border-amber-500 text-amber-600">
          <Shield className="mr-1.5 h-3 w-3" />
          Admin View
        </Badge>
      </PageHeader>

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
                setPage(1);
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
      <DataTableContainer>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <DataTableLoading rows={5} columns={8} />
        ) : error ? (
          <InlineError
            title="Failed to load organizations"
            error={error}
            onRetry={() => loadOrganizations()}
          />
        ) : organizations.length === 0 ? (
          <EmptyState
            title="No organizations found"
            description={
              search || planFilter
                ? 'Try adjusting your search or filters'
                : 'No organizations have been created yet'
            }
            variant={search || planFilter ? 'filter' : 'empty'}
            icon={Building2}
          />
        ) : (
          <>
            <DataTable>
              <DataTableHeader>
                <tr>
                  <DataTableHead>Organization</DataTableHead>
                  <DataTableHead>Plan</DataTableHead>
                  <DataTableHead align="right">Jobs Today</DataTableHead>
                  <DataTableHead align="right">Active Jobs</DataTableHead>
                  <DataTableHead align="right">Queues</DataTableHead>
                  <DataTableHead align="right">Workers</DataTableHead>
                  <DataTableHead>Created</DataTableHead>
                  <DataTableHead align="right"></DataTableHead>
                </tr>
              </DataTableHeader>
              <tbody className="divide-y">
                {organizations.map((org) => (
                  <DataTableRow key={org.id} clickable>
                    <DataTableCell>
                      <div>
                        <a
                          href={`/admin/organizations/${org.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {org.name}
                        </a>
                        <div className="text-xs text-muted-foreground">{org.slug}</div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={getPlanBadgeVariant(org.plan_tier)} className="capitalize">
                        {org.plan_tier}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell align="right" mono>
                      {org.usage.jobs_today.toLocaleString()}
                    </DataTableCell>
                    <DataTableCell align="right" mono>
                      {org.usage.active_jobs.toLocaleString()}
                    </DataTableCell>
                    <DataTableCell align="right" mono>
                      {org.usage.queues}
                    </DataTableCell>
                    <DataTableCell align="right" mono>
                      {org.usage.workers}
                    </DataTableCell>
                    <DataTableCell muted>{formatRelativeTime(org.created_at)}</DataTableCell>
                    <DataTableCell align="right">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={`/admin/organizations/${org.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </tbody>
            </DataTable>

            {/* Pagination */}
            {totalPages > 1 && (
              <DataTablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </DataTableContainer>
    </div>
  );
}
