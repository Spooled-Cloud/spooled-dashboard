/**
 * React hooks for WebSocket real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { wsClient, WS_CHANNELS } from './client';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import { queryKeys } from '@/lib/query-client';
import type { WebSocketEvent, WebSocketEventType } from '@/lib/types';

/** Trailing window in which WebSocket-driven invalidations of one query family coalesce. */
export const INVALIDATION_COALESCE_MS = 1500;

/** Delay before reconnecting after the session probe succeeded following a 1008 close. */
const AUTH_RECONNECT_DELAY_MS = 5000;

type Invalidator = (key: QueryKey) => void;
const invalidators = new WeakMap<QueryClient, { invalidate: Invalidator; cancel: () => void }>();

/**
 * Coalescing invalidator, one per QueryClient. The first event for a query family starts
 * a timer; every further event for that family inside the window is absorbed, and the
 * family is invalidated once when the timer fires. A busy org (dozens of job events per
 * second) therefore costs one refetch per family per window instead of one per event,
 * and in-flight fetches are not cancelled and restarted by every event.
 */
function getInvalidator(queryClient: QueryClient) {
  let entry = invalidators.get(queryClient);
  if (!entry) {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    entry = {
      invalidate: (key) => {
        const family = String(key[0]);
        if (timers.has(family)) return;
        timers.set(
          family,
          setTimeout(() => {
            timers.delete(family);
            void queryClient.invalidateQueries({ queryKey: key }, { cancelRefetch: false });
          }, INVALIDATION_COALESCE_MS)
        );
      },
      cancel: () => {
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
      },
    };
    invalidators.set(queryClient, entry);
  }
  return entry;
}

let authRecovery: Promise<void> | null = null;

/**
 * The server closed the socket with 1008 (token expired or session revoked). Ask the API
 * whether the session is still valid: a 401 runs the client's refresh path, which either
 * stores a fresh token (the connection hook then reconnects with it) or clears the auth
 * state (the guard then routes to login). If the token is still accepted the close was
 * not about this session, so reconnect after a short pause.
 */
export function recoverFromRealtimeAuthFailure(): Promise<void> {
  if (!authRecovery) {
    authRecovery = (async () => {
      try {
        await apiClient.get(API_ENDPOINTS.AUTH.ME);
        setTimeout(() => wsClient.retryConnection(), AUTH_RECONNECT_DELAY_MS);
      } catch {
        // 401: refreshTokens() already replaced the token or cleared auth.
        // Anything else (network/5xx): fall back to the normal reconnect backoff.
        if (useAuthStore.getState().accessToken) {
          wsClient.retryConnection();
        }
      }
    })().finally(() => {
      authRecovery = null;
    });
  }
  return authRecovery;
}

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState(wsClient.getConnectionState());
  const [lastEventAt, setLastEventAt] = useState<string | null>(wsClient.getLastEventAt());
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      wsClient.setAccessToken(null);
      setIsConnected(false);
      setState('stopped');
      return;
    }

    wsClient.setAccessToken(accessToken);

    const unsubConnect = wsClient.onConnect(() => {
      setIsConnected(true);
      setState('live');
      setLastEventAt(wsClient.getLastEventAt());
    });

    const unsubDisconnect = wsClient.onDisconnect(() => {
      setIsConnected(false);
    });

    const unsubState = wsClient.onStateChange((next) => {
      setState(next);
      setIsConnected(next === 'live');
      setLastEventAt(wsClient.getLastEventAt());
    });

    const unsubAuthFailure = wsClient.onAuthFailure(() => {
      void recoverFromRealtimeAuthFailure();
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubState();
      unsubAuthFailure();
    };
  }, [accessToken, isAuthenticated]);

  const connect = useCallback(() => {
    wsClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  const retry = useCallback(() => {
    wsClient.retryConnection();
  }, []);

  return { isConnected, state, lastEventAt, connect, disconnect, retry };
}

/**
 * Hook to subscribe to a WebSocket channel
 */
export function useWebSocketChannel(
  channel: string,
  callback?: (event: WebSocketEvent) => void,
  enabled = true
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = wsClient.subscribe(channel, (event) => {
      callbackRef.current?.(event);
    });

    return unsubscribe;
  }, [channel, enabled]);
}

/**
 * Hook for global WebSocket events
 */
export function useWebSocketEvents(callback: (event: WebSocketEvent) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = wsClient.onEvent((event) => {
      callbackRef.current(event);
    });

    return unsubscribe;
  }, []);
}

/**
 * Hook to auto-refresh queries based on WebSocket events
 */
export function useWebSocketQueryInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { invalidate: invalidateQueries, cancel } = getInvalidator(queryClient);
    const unsubscribe = wsClient.onEvent((event) => {
      const eventType = event.type as WebSocketEventType;

      // Invalidate relevant queries based on event type
      switch (eventType) {
        case 'job.created':
        case 'job.status':
        case 'job.started':
        case 'job.completed':
        case 'job.failed':
        case 'job.cancelled':
          invalidateQueries(queryKeys.jobs.all);
          invalidateQueries(queryKeys.dashboard.all);
          break;

        case 'queue.paused':
        case 'queue.resumed':
        case 'queue.stats':
          invalidateQueries(queryKeys.queues.all);
          invalidateQueries(queryKeys.dashboard.all);
          break;

        case 'worker.registered':
        case 'worker.heartbeat':
        case 'worker.deregistered':
          invalidateQueries(queryKeys.workers.all);
          invalidateQueries(queryKeys.dashboard.all);
          break;

        case 'workflow.started':
        case 'workflow.completed':
        case 'workflow.failed':
          // Reserved: backend realtime.rs does not emit workflow events yet.
          // Keep invalidation so a future event type lights up list refresh.
          invalidateQueries(queryKeys.workflows.all);
          break;

        case 'schedule.triggered':
          // Reserved: backend does not emit schedule events on the WS stream yet.
          invalidateQueries(queryKeys.schedules.all);
          break;
      }
    });

    return () => {
      unsubscribe();
      cancel();
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to job updates
 */
export function useJobUpdates(jobId: string, onUpdate?: (event: WebSocketEvent) => void) {
  useWebSocketChannel(WS_CHANNELS.job(jobId), onUpdate, !!jobId);
}

/**
 * Hook to subscribe to queue updates
 */
export function useQueueUpdates(queueName: string, onUpdate?: (event: WebSocketEvent) => void) {
  useWebSocketChannel(WS_CHANNELS.queue(queueName), onUpdate, !!queueName);
}

/**
 * Hook to subscribe to workflow updates
 */
export function useWorkflowUpdates(workflowId: string, onUpdate?: (event: WebSocketEvent) => void) {
  useWebSocketChannel(WS_CHANNELS.workflow(workflowId), onUpdate, !!workflowId);
}

/**
 * Hook for dashboard real-time updates
 */
export function useDashboardUpdates() {
  const queryClient = useQueryClient();

  useWebSocketChannel(WS_CHANNELS.DASHBOARD, () => {
    getInvalidator(queryClient).invalidate(queryKeys.dashboard.all);
  });
}
