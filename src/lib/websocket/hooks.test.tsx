import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import type { WebSocketEvent } from '@/lib/types';
import { server } from '@/test/mocks/server';
import { useAuthStore } from '@/stores/auth';

const hoisted = vi.hoisted(() => ({
  eventCb: null as null | ((e: unknown) => void),
  authFailureCb: null as null | (() => void),
  retryConnection: vi.fn(),
}));

vi.mock('./client', () => ({
  WS_CHANNELS: { DASHBOARD: 'dashboard', job: (id: string) => `job:${id}` },
  wsClient: {
    getConnectionState: () => 'live',
    getLastEventAt: () => null,
    setAccessToken: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    retryConnection: hoisted.retryConnection,
    onConnect: () => () => {},
    onDisconnect: () => () => {},
    onStateChange: () => () => {},
    onAuthFailure: (cb: () => void) => {
      hoisted.authFailureCb = cb;
      return () => {
        hoisted.authFailureCb = null;
      };
    },
    onEvent: (cb: (e: unknown) => void) => {
      hoisted.eventCb = cb;
      return () => {
        hoisted.eventCb = null;
      };
    },
    subscribe: () => () => {},
  },
}));

import {
  useWebSocketQueryInvalidation,
  useWebSocketConnection,
  INVALIDATION_COALESCE_MS,
} from './hooks';

function jobEvent(type = 'job.status'): WebSocketEvent {
  return { type, channel: 'jobs', payload: {}, timestamp: new Date().toISOString() };
}

describe('useWebSocketQueryInvalidation', () => {
  let queryClient: QueryClient;
  let spy: ReturnType<typeof vi.spyOn>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of job events into one invalidation per query family', () => {
    renderHook(() => useWebSocketQueryInvalidation(), { wrapper });

    for (let i = 0; i < 200; i++) {
      hoisted.eventCb!(jobEvent(i % 2 ? 'job.created' : 'job.completed'));
    }
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(INVALIDATION_COALESCE_MS);

    const keys = spy.mock.calls.map((c: unknown[]) => (c[0] as { queryKey: string[] }).queryKey[0]);
    expect(keys.sort()).toEqual(['dashboard', 'jobs']);
    expect(spy.mock.calls[0][1]).toEqual({ cancelRefetch: false });
  });

  it('keeps refreshing at the window rate under a continuous stream', () => {
    renderHook(() => useWebSocketQueryInvalidation(), { wrapper });

    for (let t = 0; t < 3 * INVALIDATION_COALESCE_MS; t += 100) {
      hoisted.eventCb!(jobEvent());
      vi.advanceTimersByTime(100);
    }

    // One flush per window (two query families each), not starved and not per event
    expect(spy.mock.calls.length).toBe(6);
  });

  it('drops pending invalidations on unmount', () => {
    const { unmount } = renderHook(() => useWebSocketQueryInvalidation(), { wrapper });
    hoisted.eventCb!(jobEvent());
    unmount();
    vi.advanceTimersByTime(INVALIDATION_COALESCE_MS * 2);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useWebSocketConnection auth failure (close 1008)', () => {
  beforeEach(() => {
    hoisted.retryConnection.mockClear();
    useAuthStore.setState({
      accessToken: 'jwt',
      refreshToken: null,
      expiresAt: Date.now() + 3600_000,
      isAuthenticated: true,
    });
  });

  it('clears the session (routes to login) when the server revoked the token', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () =>
        HttpResponse.json({ code: 'unauthorized', message: 'expired' }, { status: 401 })
      )
    );
    renderHook(() => useWebSocketConnection());

    await act(async () => {
      hoisted.authFailureCb!();
    });

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(hoisted.retryConnection).not.toHaveBeenCalled();
  });

  it('reconnects after a pause when the session is still valid', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderHook(() => useWebSocketConnection());
      await act(async () => {
        hoisted.authFailureCb!();
      });
      await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBe('jwt'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(hoisted.retryConnection).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
