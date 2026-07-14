import { RuntimeConfigBootstrap } from '@/components/providers/RuntimeConfigBootstrap';
import { AdminLoginPage } from '@/components/admin/AdminLoginPage';

export function AdminLoginShell() {
  return (
    <RuntimeConfigBootstrap>
      <AdminLoginPage />
    </RuntimeConfigBootstrap>
  );
}
