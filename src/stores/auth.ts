/**
 * Authentication Store
 *
 * Manages user authentication state including:
 * - Access and refresh tokens
 * - Organization context
 * - Login/logout operations
 *
 * Note: This system uses API keys for authentication, not email/password.
 * The "user" is really the API key context (org + key ID).
 *
 * SECURITY:
 * - Access tokens (short-lived, typically 24h) are persisted in localStorage
 * - Refresh tokens are stored in memory only, NOT in localStorage
 * - This means users stay logged in for the access token duration
 * - But need to re-login after the access token expires (more secure than
 *   storing long-lived refresh tokens in XSS-vulnerable localStorage)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LoginResponse, Organization } from '@/lib/types';
import { apiClient } from '@/lib/api/client';
import { loadRuntimeConfig } from '@/lib/config/runtime';
import { API_ENDPOINTS } from '@/lib/constants/api';
import { clearStoredTimeseries, timeseriesStorageKey } from '@/lib/hooks/timeseries-storage';
import { rememberReturnPath } from './return-path';

/**
 * The organization as persisted in localStorage. `settings` carries the inbound webhook
 * token and `billing_email` is personal data; neither belongs in storage that outlives
 * the session. They stay in memory (fetchCurrentUser refills them after a reload).
 */
function toPersistedOrganization(org: Organization | null): Organization | null {
  if (!org) return null;
  const { billing_email: _billingEmail, settings: _settings, ...rest } = org;
  return { ...rest, settings: {} };
}

/** Current user/session info from /auth/me */
interface CurrentUser {
  organization_id: string;
  api_key_id: string;
  queues: string[];
  issued_at: string;
  expires_at: string;
}

interface AuthState {
  // State
  user: CurrentUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  setAuth: (data: LoginResponse) => void;
  clearAuth: () => void;
  setUser: (user: CurrentUser) => void;
  fetchCurrentUser: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      organizations: [],
      currentOrganization: null,
      isLoading: true,
      isAuthenticated: false,

      // Set authentication data from login response
      setAuth: (data: LoginResponse) => {
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          isAuthenticated: true,
          isLoading: false,
        });
        // Fetch user info after setting tokens
        get().fetchCurrentUser();
      },

      // Clear authentication
      clearAuth: () => {
        // The trend history belongs to the session's org/user: drop it with the session.
        const { user, currentOrganization } = get();
        const orgId = currentOrganization?.id ?? user?.organization_id;
        clearStoredTimeseries(
          orgId && user?.api_key_id ? timeseriesStorageKey(orgId, user.api_key_id) : null
        );
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          organizations: [],
          currentOrganization: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      // Update user profile
      setUser: (user: CurrentUser) => {
        set({ user });
      },

      // Fetch current user info from /auth/me and organization details
      fetchCurrentUser: async () => {
        try {
          const user = await apiClient.get<CurrentUser>(API_ENDPOINTS.AUTH.ME);
          set({ user });

          // Also fetch organization details if we have an organization_id
          if (user.organization_id) {
            try {
              const org = await apiClient.get<Organization>(
                API_ENDPOINTS.ORGANIZATIONS.GET(user.organization_id)
              );
              set({ currentOrganization: org, organizations: [org] });
            } catch (orgError) {
              console.warn('Failed to fetch organization details:', orgError);
            }
          }
        } catch {
          // Silently fail - user info is optional for basic functionality
          console.warn('Failed to fetch current user info');
        }
      },

      // Switch organization context
      switchOrganization: async (orgId: string) => {
        const org = get().organizations.find((o) => o.id === orgId);
        if (org) {
          set({ currentOrganization: org });
        }
      },

      // Refresh access token
      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().clearAuth();
          return;
        }

        try {
          const response = await apiClient.post<{
            access_token: string;
            token_type: string;
            expires_in: number;
          }>(API_ENDPOINTS.AUTH.REFRESH, { refresh_token: refreshToken }, { skipAuth: true });
          set({
            accessToken: response.access_token,
            expiresAt: Date.now() + response.expires_in * 1000,
          });
        } catch {
          // Remember where the user was before the state is cleared and the page leaves
          rememberReturnPath();
          get().clearAuth();
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      },

      // Logout
      logout: async () => {
        try {
          // Send the refresh token too so the backend can blacklist it —
          // otherwise the session survives logout via /auth/refresh.
          const { refreshToken } = get();
          await apiClient.post(
            API_ENDPOINTS.AUTH.LOGOUT,
            refreshToken ? { refresh_token: refreshToken } : undefined
          );
        } catch {
          // Silently ignore logout errors - we clear local state regardless
        } finally {
          get().clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      // Persist accessToken (short-lived) and organization context
      // refreshToken is intentionally NOT persisted for security (XSS protection)
      // Users will need to re-login after the access token expires (typically 24h)
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
        currentOrganization: toPersistedOrganization(state.currentOrganization),
        user: state.user,
      }),
      // v1: stop persisting organization settings (webhook token) and billing_email.
      // Returning from migrate makes zustand rewrite the stored value right away, which
      // scrubs copies written by older versions.
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { currentOrganization?: Organization | null };
        return {
          ...state,
          currentOrganization: toPersistedOrganization(state.currentOrganization ?? null),
        } as never;
      },
    }
  )
);

// Initialize API client with auth store
if (typeof window !== 'undefined') {
  apiClient.setTokenGetter(() => useAuthStore.getState().accessToken);
  apiClient.setOrgIdGetter(() => useAuthStore.getState().currentOrganization?.id || null);
  apiClient.setRefreshHandler(() => useAuthStore.getState().refreshTokens());

  // Check if token is expired and clear auth if so
  function checkTokenExpiration() {
    const state = useAuthStore.getState();
    if (state.accessToken && state.expiresAt) {
      if (Date.now() > state.expiresAt) {
        console.warn('Token expired, clearing auth');
        rememberReturnPath();
        useAuthStore.getState().clearAuth();
        // Redirect to login
        window.location.href = '/';
      }
    }
  }

  // After rehydration, check if token is still valid. localStorage hydration is
  // synchronous and has already finished inside create(), so a listener added now would
  // never fire: run the check right away, and keep the listener for async storages.
  const onHydrated = (state: AuthState | undefined) => {
    // Set loading to false after hydration
    useAuthStore.setState({ isLoading: false });
    if (!state) return;

    // If we have a token but it's expired, clear auth
    if (state.accessToken && state.expiresAt) {
      if (Date.now() > state.expiresAt) {
        useAuthStore.getState().clearAuth();
        return;
      }

      // We have a valid token. If user/organization context wasn't restored
      // (older login before this code shipped, prior fetch failed, or storage
      // was partially cleared), fetch it now so pages like /settings/organization
      // don't get stuck on "No organization selected".
      //
      // Wait for the runtime config first: until /api/config answers, the API client only
      // knows the hosted default host, and this request carries the session token. If
      // the config cannot be loaded (hosted dashboards refuse to guess a host), skip it.
      if (!state.user || !state.currentOrganization) {
        loadRuntimeConfig()
          .then(() => useAuthStore.getState().fetchCurrentUser())
          .catch(() => {});
      }
    }
  };

  if (useAuthStore.persist.hasHydrated()) {
    onHydrated(useAuthStore.getState());
  } else {
    useAuthStore.persist.onFinishHydration(onHydrated);
  }

  // Periodically check token expiration (every minute)
  setInterval(checkTokenExpiration, 60 * 1000);

  // Also check on visibility change (when user comes back to tab)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkTokenExpiration();
    }
  });
}
