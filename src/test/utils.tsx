/**
 * Test Utilities
 * Helper functions and custom render for testing
 */

import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

// Wrapper with all providers
function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Custom render function
function customRender(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };

// Helper to wait for loading to complete
export async function waitForLoadingToFinish() {
  const { waitFor, screen } = await import('@testing-library/react');
  await waitFor(() => {
    const loaders = screen.queryAllByTestId('loading');
    if (loaders.length > 0) {
      throw new Error('Still loading');
    }
  });
}

// Helper to mock authenticated state
export async function mockAuthenticatedState() {
  const { useAuthStore } = await import('@/stores/auth');
  useAuthStore.setState({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    user: {
      organization_id: 'org-1',
      api_key_id: 'key-1',
      queues: ['*'],
      issued_at: '2024-01-01T00:00:00Z',
      expires_at: '2024-01-02T00:00:00Z',
    },
    currentOrganization: {
      id: 'org-1',
      name: 'Test Organization',
      slug: 'test-org',
      plan_tier: 'professional',
      settings: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    isAuthenticated: true,
    isLoading: false,
  });
}

// Helper to clear auth state
export async function clearAuthState() {
  const { useAuthStore } = await import('@/stores/auth');
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    currentOrganization: null,
    isAuthenticated: false,
    isLoading: false,
  });
}
