import { AuthGuard } from '@/components/auth/AuthGuard';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
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
 * 3. Real-time WebSocket updates are enabled
 * 4. Toast notifications are available
 */
export function ProtectedPage({ children }: ProtectedPageProps) {
  return (
    <QueryProvider>
      <AuthGuard>
        <RealtimeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </RealtimeProvider>
      </AuthGuard>
    </QueryProvider>
  );
}
