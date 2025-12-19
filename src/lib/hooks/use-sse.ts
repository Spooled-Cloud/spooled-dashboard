/**
 * SSE (Server-Sent Events) Hook for real-time updates
 * 
 * Provides a React hook for subscribing to SSE streams from the backend.
 * Falls back gracefully to polling if SSE connection fails.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '@/lib/config/runtime';
import { useAuthStore } from '@/stores/auth';

export interface SSEOptions {
  /** Whether to enable SSE (default: true) */
  enabled?: boolean;
  /** Callback when an event is received */
  onEvent?: (event: SSEEvent) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when connection opens */
  onOpen?: () => void;
  /** Callback when connection closes */
  onClose?: () => void;
  /** Max reconnection attempts before giving up (default: 5) */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
}

export interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface UseSSEReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnect: () => void;
}

/**
 * Hook for subscribing to job-specific SSE events
 * Endpoint: GET /api/v1/events/jobs/{id}
 */
export function useJobSSE(jobId: string, options: SSEOptions = {}): UseSSEReturn {
  const endpoint = `/api/v1/events/jobs/${jobId}`;
  return useSSE(endpoint, {
    ...options,
    onEvent: (event) => {
      options.onEvent?.(event);
    },
  });
}

/**
 * Hook for subscribing to queue-specific SSE events
 * Endpoint: GET /api/v1/events/queues/{name}
 */
export function useQueueSSE(queueName: string, options: SSEOptions = {}): UseSSEReturn {
  const endpoint = `/api/v1/events/queues/${encodeURIComponent(queueName)}`;
  return useSSE(endpoint, {
    ...options,
    onEvent: (event) => {
      options.onEvent?.(event);
    },
  });
}

/**
 * Generic SSE hook
 */
export function useSSE(endpoint: string, options: SSEOptions = {}): UseSSEReturn {
  const {
    enabled = true,
    onEvent,
    onError,
    onOpen,
    onClose,
    maxReconnectAttempts = 5,
    reconnectDelay = 3000,
  } = options;

  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !accessToken) {
      return;
    }

    cleanup();
    setIsConnecting(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      // SSE requires token in query params since headers can't be set
      const url = `${apiUrl}${endpoint}?token=${encodeURIComponent(accessToken)}`;
      
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          onEvent?.(data);
          
          // Invalidate relevant queries based on event type
          if (data.type === 'job_status_changed' || data.type === 'job_completed' || data.type === 'job_failed') {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
          }
          if (data.type === 'queue_stats_updated') {
            queryClient.invalidateQueries({ queryKey: ['queues'] });
          }
        } catch (parseError) {
          console.warn('Failed to parse SSE event:', parseError);
        }
      };

      eventSource.onerror = (_e) => {
        setIsConnected(false);
        setIsConnecting(false);
        
        const sseError = new Error('SSE connection error');
        setError(sseError);
        onError?.(sseError);

        // Close the failed connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt reconnection if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current); // Exponential backoff
        } else {
          console.warn(`SSE: Max reconnection attempts (${maxReconnectAttempts}) reached for ${endpoint}`);
        }
      };
    } catch (err) {
      setIsConnecting(false);
      const connectError = err instanceof Error ? err : new Error('Failed to connect to SSE');
      setError(connectError);
      onError?.(connectError);
    }
  }, [enabled, accessToken, endpoint, cleanup, onOpen, onEvent, onError, maxReconnectAttempts, reconnectDelay, queryClient]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled && accessToken) {
      connect();
    }

    return () => {
      cleanup();
      onClose?.();
    };
  }, [enabled, accessToken, endpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}

/**
 * SSE connection status indicator component props
 */
export interface SSEStatusIndicatorProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  onReconnect?: () => void;
}

