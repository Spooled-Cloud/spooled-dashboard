import { AuthGuard } from '@/components/auth/AuthGuard';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from '@/components/ui/toast';

interface ProtectedPageProps {
  children: React.ReactNode;
}

/**
 * ProtectedPage - Wraps page content with authentication and query provider
 *
 * Use this for all dashboard pages to ensure:
 * 1. User is authenticated (redirects to login if not)
 * 2. TanStack Query context is available
 * 3. Toast notifications are available
 */
export function ProtectedPage({ children }: ProtectedPageProps) {
  return (
    <QueryProvider>
      <AuthGuard>
        {children}
        <Toaster richColors position="top-right" />
      </AuthGuard>
    </QueryProvider>
  );
}
