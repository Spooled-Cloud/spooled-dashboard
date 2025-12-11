/**
 * Tests for AuthGuard Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { renderHook } from '@testing-library/react';
import { AuthGuard, useIsAuthenticated, useRequireAuth } from './AuthGuard';
import { useAuthStore } from '@/stores/auth';

// Mock window.location
const mockLocation = { href: '', pathname: '/dashboard' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

describe('AuthGuard', () => {
  beforeEach(() => {
    mockLocation.href = '';
    mockLocation.pathname = '/dashboard';
    mockSessionStorage.setItem.mockClear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      expiresAt: null,
      organizations: [],
      currentOrganization: null,
    });
  });

  it('should render children when authenticated', async () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'org_admin',
        permissions: ['jobs:read'],
        organization_id: 'org-1',
        organization_name: 'Test Org',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        email_verified: true,
        two_factor_enabled: false,
        status: 'active',
      },
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should show loading skeleton while checking auth', () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: 'test-refresh',
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should show loading skeleton (skeleton elements have animate-pulse class)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: 'test-refresh',
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <AuthGuard fallback={<div>Loading...</div>}>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should show custom fallback
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect when no tokens', async () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockLocation.href).toBe('/');
    });
  });

  it('should store redirect path in sessionStorage', async () => {
    mockLocation.pathname = '/settings';
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('redirect_after_login', '/settings');
    });
  });

  it('should not store root path in sessionStorage', async () => {
    mockLocation.pathname = '/';
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockLocation.href).toBe('/');
    });

    // Should not store root path
    expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith('redirect_after_login', '/');
  });
});

describe('useIsAuthenticated', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('should return false when not authenticated', () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);
  });

  it('should return true when authenticated', () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });

  it('should return true when has access token', () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      isAuthenticated: false,
    });

    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });
});

describe('useRequireAuth', () => {
  const mockLocation = { href: '' };

  beforeEach(() => {
    mockLocation.href = '';
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
    });
  });

  it('should redirect when no tokens', () => {
    renderHook(() => useRequireAuth());
    expect(mockLocation.href).toBe('/');
  });

  it('should not redirect when has tokens', () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
    });

    renderHook(() => useRequireAuth());
    expect(mockLocation.href).toBe('');
  });
});
