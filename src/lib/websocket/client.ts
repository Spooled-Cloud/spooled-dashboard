/**
 * WebSocket Client for Real-time Updates
 */

import { getWsUrl, API_ENDPOINTS } from '@/lib/constants/api';
import type { WebSocketMessage, WebSocketEvent } from '@/lib/types';

type EventCallback = (event: WebSocketEvent) => void;
type ConnectionCallback = () => void;

interface WebSocketClientOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

const DEFAULT_OPTIONS: Required<WebSocketClientOptions> = {
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimeout: ReturnType<typeof setInterval> | null = null;
  private subscriptions = new Map<string, Set<EventCallback>>();
  private globalListeners = new Set<EventCallback>();
  private connectionListeners = new Set<ConnectionCallback>();
  private disconnectionListeners = new Set<ConnectionCallback>();
  private isManualClose = false;
  private accessToken: string | null = null;

  constructor(options?: WebSocketClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get the WebSocket URL (uses runtime config)
   */
  private getUrl(): string {
    return `${getWsUrl()}${API_ENDPOINTS.REALTIME.WS}`;
  }

  /**
   * Set the access token for authentication
   */
  setAccessToken(token: string | null) {
    this.accessToken = token;
    // Reconnect if already connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.connect();
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isManualClose = false;

    try {
      const baseUrl = this.getUrl();
      const wsUrl = this.accessToken
        ? `${baseUrl}?token=${encodeURIComponent(this.accessToken)}`
        : baseUrl;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch {
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: EventCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      // Send subscribe message if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'subscribe', channel });
      }
    }

    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(channel);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(channel);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'unsubscribe', channel });
          }
        }
      }
    };
  }

  /**
   * Add a global event listener (receives all events)
   */
  onEvent(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  /**
   * Add connection listener
   */
  onConnect(callback: ConnectionCallback): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Add disconnection listener
   */
  onDisconnect(callback: ConnectionCallback): () => void {
    this.disconnectionListeners.add(callback);
    return () => this.disconnectionListeners.delete(callback);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      default:
        return 'closed';
    }
  }

  private handleOpen() {
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    // Re-subscribe to all channels
    for (const channel of this.subscriptions.keys()) {
      this.send({ type: 'subscribe', channel });
    }

    // Notify listeners
    this.connectionListeners.forEach((cb) => cb());
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as WebSocketEvent;

      // Notify global listeners
      this.globalListeners.forEach((cb) => cb(data));

      // Notify channel subscribers
      const channelSubs = this.subscriptions.get(data.channel);
      if (channelSubs) {
        channelSubs.forEach((cb) => cb(data));
      }
    } catch {
      // Silently ignore malformed messages
    }
  }

  private handleClose(_event: CloseEvent) {
    this.stopHeartbeat();
    this.ws = null;

    // Notify listeners
    this.disconnectionListeners.forEach((cb) => cb());

    if (!this.isManualClose) {
      this.scheduleReconnect();
    }
  }

  private handleError(_event: Event) {
    // Error handling is done in handleClose
  }

  private send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimeout = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimeout) {
      clearInterval(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

// Channel names
export const WS_CHANNELS = {
  DASHBOARD: 'dashboard',
  JOBS: 'jobs',
  QUEUES: 'queues',
  WORKERS: 'workers',
  WORKFLOWS: 'workflows',
  queue: (name: string) => `queue:${name}`,
  job: (id: string) => `job:${id}`,
  workflow: (id: string) => `workflow:${id}`,
} as const;
