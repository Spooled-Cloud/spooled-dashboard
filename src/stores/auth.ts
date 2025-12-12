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
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LoginResponse, Organization } from '@/lib/types';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';

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

      // Fetch current user info from /auth/me
      fetchCurrentUser: async () => {
        try {
          const user = await apiClient.get<CurrentUser>(API_ENDPOINTS.AUTH.ME);
          set({ user });
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
          await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
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
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        currentOrganization: state.currentOrganization,
      }),
    }
  )
);

// Initialize API client with auth store
if (typeof window !== 'undefined') {
  apiClient.setTokenGetter(() => useAuthStore.getState().accessToken);
  apiClient.setOrgIdGetter(() => useAuthStore.getState().currentOrganization?.id || null);
  apiClient.setRefreshHandler(() => useAuthStore.getState().refreshTokens());
}
