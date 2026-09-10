import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useSSE } from './use-sse';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0;
  closed = false;
  private listeners: Record<string, Array<(ev: MessageEvent) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      if (!this.closed && this.onopen) {
        this.readyState = 1;
        this.onopen(new Event('open'));
      }
    });
  }

  addEventListener(type: string, fn: EventListenerOrEventListenerObject) {
    const handler = fn as (ev: MessageEvent) => void;
    (this.listeners[type] ??= []).push(handler);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emitMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(data),
      })
    );
  }

  emitNamed(type: string, data: unknown) {
    const ev = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const fn of this.listeners[type] ?? []) {
      fn(ev);
    }
  }

  emitError() {
    this.onerror?.(new Event('error'));
  }
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ accessToken: 'test-token' }),
}));

vi.mock('@/lib/config/runtime', () => ({
  getApiUrl: () => 'https://api.test',
}));

describe('useSSE', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('connects and reports isConnected after open', async () => {
    const { result } = renderHook(() => useSSE('/api/v1/events/jobs/abc'), { wrapper });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
    expect(MockEventSource.instances[0]?.url).toContain('token=test-token');
  });

  it('invokes onEvent for parsed messages', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(
      () => useSSE('/api/v1/events/jobs/abc', { onEvent, reconnectDelay: 10 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitMessage({
        type: 'job_completed',
        data: { id: 'abc' },
        timestamp: new Date().toISOString(),
      });
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'job_completed' }));
  });

  it('handles named SSE frames the backend actually sends (event: job.status)', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(
      () => useSSE('/api/v1/events/jobs/abc', { onEvent, reconnectDelay: 10 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitNamed('job.status', {
        type: 'JobStatusChange',
        data: { job_id: 'abc', new_status: 'completed', timestamp: '2024-01-01T00:00:00Z' },
      });
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_status_changed',
        data: expect.objectContaining({ job_id: 'abc' }),
      })
    );
  });

  it('reconnect() resets attempts and opens a new EventSource', async () => {
    const { result } = renderHook(
      () => useSSE('/api/v1/events/queues/default', { maxReconnectAttempts: 1, reconnectDelay: 5 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    const first = MockEventSource.instances[0];

    act(() => {
      result.current.reconnect();
    });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThan(1);
    });
    expect(first?.closed).toBe(true);
  });
});
