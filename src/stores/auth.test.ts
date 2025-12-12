/**
 * Tests for Auth Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth';

// Mock window.location
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
      isLoading: false,
    });
    mockLocation.href = '';
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.currentOrganization).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('should set auth data from login response', () => {
      const mockLoginResponse = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 86400,
      };

      useAuthStore.getState().setAuth(mockLoginResponse);

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('access-123');
      expect(state.refreshToken).toBe('refresh-456');
      expect(state.isAuthenticated).toBe(true);
      expect(state.expiresAt).toBeDefined();
    });
  });

  describe('setUser', () => {
    it('should set user data', () => {
      const mockUser = {
        organization_id: 'org-1',
        api_key_id: 'key-1',
        queues: ['*'],
        issued_at: '2024-01-01T00:00:00Z',
        expires_at: '2024-01-02T00:00:00Z',
      };

      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.user?.organization_id).toBe('org-1');
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth state', () => {
      // First, set some state
      useAuthStore.getState().setAuth({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 86400,
      });

      // Verify it was set
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Clear auth
      useAuthStore.getState().clearAuth();

      // Verify it's cleared
      const state = useAuthStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.currentOrganization).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('switchOrganization', () => {
    it('should switch to organization from list', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        plan_tier: 'professional',
        settings: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Set organizations list
      useAuthStore.setState({ organizations: [mockOrg] });

      // Switch to org
      await useAuthStore.getState().switchOrganization('org-1');

      expect(useAuthStore.getState().currentOrganization).toEqual(mockOrg);
    });

    it('should not change if organization not found', async () => {
      useAuthStore.setState({ organizations: [], currentOrganization: null });

      await useAuthStore.getState().switchOrganization('non-existent');

      expect(useAuthStore.getState().currentOrganization).toBeNull();
    });
  });

  describe('refreshTokens', () => {
    it('should clear auth if no refresh token', async () => {
      useAuthStore.setState({
        refreshToken: null,
        isAuthenticated: true,
      });

      await useAuthStore.getState().refreshTokens();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear auth and redirect', async () => {
      useAuthStore.setState({
        accessToken: 'test-token',
        isAuthenticated: true,
      });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(mockLocation.href).toBe('/');
    });
  });

  describe('state persistence', () => {
    it('should track isLoading state', () => {
      useAuthStore.setState({ isLoading: true });
      expect(useAuthStore.getState().isLoading).toBe(true);

      useAuthStore.setState({ isLoading: false });
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should track expiresAt', () => {
      const futureTime = Date.now() + 3600000;
      useAuthStore.setState({ expiresAt: futureTime });
      expect(useAuthStore.getState().expiresAt).toBe(futureTime);
    });
  });
});
