/**
 * Authentication Store
 *
 * Manages user authentication state including:
 * - User profile
 * - Access and refresh tokens
 * - Organization context
 * - Login/logout operations
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginResponse, Organization } from '@/lib/types';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';

interface AuthState {
  // State
  user: User | null;
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
  setUser: (user: User) => void;
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

      // Set authentication data
      setAuth: (data: LoginResponse) => {
        set({
          user: data.user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
          isAuthenticated: true,
          isLoading: false,
        });
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
      setUser: (user: User) => {
        set({ user });
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
          const response = await apiClient.post<LoginResponse>(
            API_ENDPOINTS.AUTH.REFRESH,
            { refresh_token: refreshToken },
            { skipAuth: true }
          );
          get().setAuth(response);
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
