/**
 * Tests for Auth Store
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { waitFor } from '@testing-library/react';
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
    it('should set auth data from login response', async () => {
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

      // setAuth starts fetchCurrentUser without awaiting it. Let it finish here, or it sets the
      // organization in the middle of a later test.
      await waitFor(() => expect(useAuthStore.getState().currentOrganization).not.toBeNull());
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
    it('should clear all auth state', async () => {
      // First, set some state
      useAuthStore.getState().setAuth({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_expires_in: 86400,
      });

      // Verify it was set, including the user and organization setAuth fetches in the background
      // (left running, that fetch would set them again after the clear, during a later test)
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      await waitFor(() => expect(useAuthStore.getState().currentOrganization).not.toBeNull());
      expect(useAuthStore.getState().user).not.toBeNull();

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

const FULL_ORG = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  plan_tier: 'pro',
  billing_email: 'billing@acme.test',
  settings: { webhook_token: 'whtok_secret', theme: 'x' },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('persisted auth state', () => {
  it('does not persist organization settings or billing_email', () => {
    useAuthStore.setState({
      accessToken: 'jwt',
      isAuthenticated: true,
      currentOrganization: FULL_ORG,
    });

    const persisted = useAuthStore.persist.getOptions().partialize!(
      useAuthStore.getState()
    ) as unknown as {
      currentOrganization: Record<string, unknown>;
    };

    expect(persisted.currentOrganization.id).toBe('org-1');
    expect(persisted.currentOrganization.name).toBe('Acme');
    expect(persisted.currentOrganization.plan_tier).toBe('pro');
    expect(persisted.currentOrganization.settings).toEqual({});
    expect(persisted.currentOrganization).not.toHaveProperty('billing_email');
    expect(JSON.stringify(persisted)).not.toContain('whtok_secret');
    // The in-memory organization keeps the full record
    expect(useAuthStore.getState().currentOrganization?.settings).toHaveProperty('webhook_token');
  });

  it('scrubs an organization stored by an older version on migrate', () => {
    const migrate = useAuthStore.persist.getOptions().migrate!;
    const migrated = migrate(
      { accessToken: 'jwt', currentOrganization: FULL_ORG },
      0
    ) as unknown as {
      accessToken: string;
      currentOrganization: Record<string, unknown>;
    };
    expect(migrated.accessToken).toBe('jwt');
    expect(JSON.stringify(migrated)).not.toContain('whtok_secret');
    expect(migrated.currentOrganization).not.toHaveProperty('billing_email');
  });
});

describe('trend history on sign-out', () => {
  it('clearAuth removes the scoped and the legacy trend history keys', () => {
    useAuthStore.setState({
      accessToken: 'jwt',
      isAuthenticated: true,
      user: {
        organization_id: 'org-1',
        api_key_id: 'key-1',
        queues: [],
        issued_at: '',
        expires_at: '',
      },
      currentOrganization: FULL_ORG,
    });

    useAuthStore.getState().clearAuth();

    const removed = (localStorage.removeItem as Mock).mock.calls.map((c) => c[0]);
    expect(removed).toContain('spooled_dashboard_timeseries:org-1:key-1');
    expect(removed).toContain('spooled_dashboard_timeseries');
  });
});

describe('hydration check at load', () => {
  afterEach(() => {
    (localStorage.getItem as Mock).mockReset();
    vi.resetModules();
  });

  async function loadStoreWithStorage(state: Record<string, unknown>) {
    // The start-up check loads /api/config first: give the relative fetch a base URL and
    // the hostname the config validation reads.
    Object.assign(mockLocation, { href: 'http://localhost:3000/', hostname: 'localhost' });
    (localStorage.getItem as Mock).mockImplementation((key: string) =>
      key === 'auth-storage' ? JSON.stringify({ state, version: 1 }) : null
    );
    vi.resetModules();
    return (await import('./auth')).useAuthStore;
  }

  it('clears an expired token and finishes loading', async () => {
    const store = await loadStoreWithStorage({
      accessToken: 'expired-jwt',
      expiresAt: Date.now() - 1000,
      isAuthenticated: true,
    });

    expect(store.getState().accessToken).toBeNull();
    expect(store.getState().isAuthenticated).toBe(false);
    expect(store.getState().isLoading).toBe(false);
  });

  it('fetches the user and organization when a valid token has no context', async () => {
    const store = await loadStoreWithStorage({
      accessToken: 'valid-jwt',
      expiresAt: Date.now() + 3600_000,
      isAuthenticated: true,
    });

    expect(store.getState().isLoading).toBe(false);
    await waitFor(() => expect(store.getState().user).not.toBeNull());
    expect(store.getState().accessToken).toBe('valid-jwt');
  });
});
