/**
 * WebSocket module exports
 */

export { wsClient, WS_CHANNELS } from './client';
export {
  useWebSocketConnection,
  useWebSocketChannel,
  useWebSocketEvents,
  useWebSocketQueryInvalidation,
  useJobUpdates,
  useQueueUpdates,
  useWorkflowUpdates,
  useDashboardUpdates,
} from './hooks';
