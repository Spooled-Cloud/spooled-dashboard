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
 * Default loading skeleton for auth check
 */
function AuthLoadingSkeleton() {
  return (
    <div className="flex h-screen">
      {/* Sidebar skeleton */}
      <div className="w-64 space-y-4 border-r bg-card p-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 space-y-6 p-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
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
