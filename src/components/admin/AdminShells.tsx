import { RuntimeConfigBootstrap } from '@/components/providers/RuntimeConfigBootstrap';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminOrganizationDetail } from '@/components/admin/AdminOrganizationDetail';
import { AdminOrganizationsList } from '@/components/admin/AdminOrganizationsList';
import { AdminPlansPage } from '@/components/admin/AdminPlansPage';

export function AdminDashboardShell() {
  return (
    <RuntimeConfigBootstrap>
      <AdminDashboard />
    </RuntimeConfigBootstrap>
  );
}

export function AdminOrganizationsShell() {
  return (
    <RuntimeConfigBootstrap>
      <AdminOrganizationsList />
    </RuntimeConfigBootstrap>
  );
}

export function AdminOrganizationDetailShell({ orgId }: { orgId: string }) {
  return (
    <RuntimeConfigBootstrap>
      <AdminOrganizationDetail orgId={orgId} />
    </RuntimeConfigBootstrap>
  );
}

export function AdminPlansShell() {
  return (
    <RuntimeConfigBootstrap>
      <AdminPlansPage />
    </RuntimeConfigBootstrap>
  );
}
