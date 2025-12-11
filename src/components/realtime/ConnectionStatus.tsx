/**
 * WebSocket Connection Status Indicator
 */

import { useWebSocketConnection } from '@/lib/websocket';

export function ConnectionStatus() {
  const { isConnected, state } = useWebSocketConnection();

  return (
    <div className="flex items-center gap-2 text-xs">
      {isConnected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          <span className="hidden text-green-600 sm:inline">Live</span>
        </>
      ) : state === 'connecting' ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500"></span>
          </span>
          <span className="hidden text-yellow-600 sm:inline">Connecting...</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
          </span>
          <span className="hidden text-gray-500 sm:inline">Offline</span>
        </>
      )}
    </div>
  );
}
