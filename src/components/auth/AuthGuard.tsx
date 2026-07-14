import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * AuthGuard - Protects routes that require authentication
 *
 * Redirects to login page if user is not authenticated.
 * Shows loading skeleton while checking auth state.
 * Waits for Zustand store to rehydrate from localStorage before checking.
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { accessToken, refreshToken, isAuthenticated, refreshTokens } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Wait for Zustand to rehydrate from localStorage
  useEffect(() => {
    // Check if already hydrated
    const alreadyHydrated = useAuthStore.persist.hasHydrated();
    if (alreadyHydrated) {
      setHasHydrated(true);
    } else {
      // Wait for hydration to complete
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        setHasHydrated(true);
      });
      return () => {
        unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    // Don't check auth until store has hydrated from localStorage
    if (!hasHydrated) return;

    const checkAuth = async () => {
      // If we have a refresh token but no access token, try to refresh
      if (refreshToken && !accessToken) {
        try {
          await refreshTokens();
        } catch {
          // Refresh failed, redirect to login
          redirectToLogin();
          return;
        }
      }

      // If no tokens at all, redirect to login
      if (!refreshToken && !accessToken) {
        redirectToLogin();
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [hasHydrated, accessToken, refreshToken, refreshTokens]);

  const redirectToLogin = () => {
    if (typeof window !== 'undefined') {
      // Store the current path to redirect back after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      window.location.href = '/';
    }
  };

  // Show loading state while checking authentication
  if (isChecking) {
    return fallback || <AuthLoadingSkeleton />;
  }

  // If not authenticated, don't render anything (redirect will happen)
  if (!isAuthenticated && !accessToken) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}

/**
 * Default loading skeleton for auth check — responsive, no fixed desktop sidebar assumption.
 */
function AuthLoadingSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="safe-area-x flex h-14 shrink-0 items-center gap-3 border-b border-lane-border bg-card px-3 sm:px-4 lg:h-16 lg:px-6">
        <Skeleton className="h-9 w-9 shrink-0 rounded-sm lg:hidden" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Skeleton className="hidden h-8 w-8 shrink-0 rounded-sm sm:block" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 max-w-[60%]" />
            <Skeleton className="h-3 w-24 max-w-[45%]" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-sm" />
        <Skeleton className="h-9 w-9 shrink-0 rounded-sm" />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop sidebar skeleton — hidden on mobile */}
        <div className="hidden w-64 shrink-0 space-y-4 border-r border-lane-border bg-card p-4 lg:block">
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-sm" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="console-surface flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-6 sm:p-5 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-sm" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-sm sm:h-96" />
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { accessToken, isAuthenticated } = useAuthStore();
  return isAuthenticated || !!accessToken;
}

/**
 * Hook to require authentication - redirects if not authenticated
 * Waits for store hydration before checking
 */
export function useRequireAuth(): void {
  const { accessToken, refreshToken } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true);
    } else {
      const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
        setHasHydrated(true);
      });
      return () => {
        unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!accessToken && !refreshToken && typeof window !== 'undefined') {
      // Store the current path to redirect back after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/') {
        sessionStorage.setItem('redirect_after_login', currentPath);
      }
      window.location.href = '/';
    }
  }, [hasHydrated, accessToken, refreshToken]);
}
