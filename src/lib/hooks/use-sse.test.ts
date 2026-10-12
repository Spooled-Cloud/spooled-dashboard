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

  /** A real browser delivers its connection `error` Event to onerror and every 'error' listener. */
  emitNativeError() {
    const ev = new Event('error');
    this.onerror?.(ev);
    for (const fn of this.listeners['error'] ?? []) {
      fn(ev as MessageEvent);
    }
  }

  emitRawNamed(type: string, data: string) {
    const ev = new MessageEvent(type, { data });
    for (const fn of this.listeners[type] ?? []) {
      fn(ev);
    }
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

  it('handles job events from the global /events stream (API 0.1.114+)', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useSSE('/api/v1/events', { onEvent, reconnectDelay: 10 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitNamed('job.created', {
        type: 'JobCreated',
        data: { job_id: 'new-1', queue_name: 'emails', priority: 0 },
      });
      MockEventSource.instances[0]?.emitNamed('job.completed', {
        type: 'JobCompleted',
        data: { job_id: 'new-1', queue_name: 'emails', duration_ms: 42 },
      });
    });

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'job_created' }));
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_completed',
        data: expect.objectContaining({ duration_ms: 42 }),
      })
    );
  });

  it('does not warn about a payload when the browser fires its own error event', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEvent = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useSSE('/api/v1/events/jobs/abc', {
          onEvent,
          onError,
          maxReconnectAttempts: 0,
          reconnectDelay: 10,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitNativeError();
    });

    // The connection error is still reported through onerror ...
    expect(onError).toHaveBeenCalledTimes(1);
    // ... but the data-less Event is not parsed as a JSON frame.
    expect(onEvent).not.toHaveBeenCalled();
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('Failed to parse'))).toHaveLength(0);
    warn.mockRestore();
  });

  it('skips frames with an empty data field instead of warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEvent = vi.fn();
    const { result } = renderHook(() => useSSE('/api/v1/events', { onEvent }), { wrapper });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitRawNamed('system.health', '');
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still reports a genuinely malformed JSON frame', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onEvent = vi.fn();
    const { result } = renderHook(() => useSSE('/api/v1/events', { onEvent }), { wrapper });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitRawNamed('job.status', '{not json');
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Failed to parse SSE event:', expect.any(SyntaxError));
    warn.mockRestore();
  });

  it('delivers a backend error frame that carries a JSON payload', async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useSSE('/api/v1/events', { onEvent }), { wrapper });

    await waitFor(() => expect(result.current.isConnected).toBe(true));

    act(() => {
      MockEventSource.instances[0]?.emitNamed('error', { message: 'stream failed' });
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', data: { message: 'stream failed' } })
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
