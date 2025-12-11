/**
 * Provider component that enables real-time updates via WebSocket
 */

import type { ReactNode } from 'react';
import { useWebSocketConnection, useWebSocketQueryInvalidation } from '@/lib/websocket';

interface RealtimeProviderProps {
  children: ReactNode;
}

function RealtimeConnectionManager() {
  // Manage WebSocket connection based on auth state
  useWebSocketConnection();

  // Auto-invalidate queries based on WebSocket events
  useWebSocketQueryInvalidation();

  return null;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  return (
    <>
      <RealtimeConnectionManager />
      {children}
    </>
  );
}
