import { AuthGuard } from '@/components/auth/AuthGuard';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { RuntimeConfigBootstrap } from '@/components/providers/RuntimeConfigBootstrap';
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider';
import { Toaster } from '@/components/ui/toast';

interface ProtectedPageProps {
  children: React.ReactNode;
}

/**
 * ProtectedPage - Wraps page content with configuration, authentication, and query provider
 *
 * Use this for all dashboard pages to ensure:
 * 1. Runtime config is loaded before API/WebSocket use
 * 2. User is authenticated (redirects to login if not)
 * 3. TanStack Query context is available
 * 4. Real-time WebSocket updates are enabled
 * 5. Toast notifications are available
 */
export function ProtectedPage({ children }: ProtectedPageProps) {
  return (
    <RuntimeConfigBootstrap>
      <QueryProvider>
        <AuthGuard>
          <RealtimeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </RealtimeProvider>
        </AuthGuard>
      </QueryProvider>
    </RuntimeConfigBootstrap>
  );
}
