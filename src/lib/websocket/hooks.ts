/**
 * React hooks for WebSocket real-time updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient, WS_CHANNELS } from './client';
import { useAuthStore } from '@/stores/auth';
import { queryKeys } from '@/lib/query-client';
import type { WebSocketEvent, WebSocketEventType } from '@/lib/types';

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<'connecting' | 'open' | 'closing' | 'closed'>('closed');
  const { accessToken } = useAuthStore();

  useEffect(() => {
    // Set token and connect
    wsClient.setAccessToken(accessToken);

    if (accessToken) {
      wsClient.connect();
    }

    const unsubConnect = wsClient.onConnect(() => {
      setIsConnected(true);
      setState('open');
    });

    const unsubDisconnect = wsClient.onDisconnect(() => {
      setIsConnected(false);
      setState('closed');
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [accessToken]);

  const connect = useCallback(() => {
    wsClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return { isConnected, state, connect, disconnect };
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
    const unsubscribe = wsClient.onEvent((event) => {
      const eventType = event.type as WebSocketEventType;

      // Invalidate relevant queries based on event type
      switch (eventType) {
        case 'job.created':
        case 'job.started':
        case 'job.completed':
        case 'job.failed':
        case 'job.cancelled':
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          break;

        case 'queue.paused':
        case 'queue.resumed':
        case 'queue.stats':
          queryClient.invalidateQueries({ queryKey: queryKeys.queues.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          break;

        case 'worker.registered':
        case 'worker.heartbeat':
        case 'worker.deregistered':
          queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
          break;

        case 'workflow.started':
        case 'workflow.completed':
        case 'workflow.failed':
          queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
          break;

        case 'schedule.triggered':
          queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
          break;
      }
    });

    return unsubscribe;
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
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  });
}
