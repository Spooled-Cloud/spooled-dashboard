/**
 * WebSocket Client for Real-time Updates
 *
 * Wire protocol matches spooled-backend `src/api/handlers/realtime.rs`:
 * - Auth: `?token=<access_jwt>`
 * - Server events: `{ "type": "JobCreated", "data": { ... } }` (serde internally tagged)
 * - Client commands: `{ "cmd": "Subscribe"|"Unsubscribe"|"Ping", queue?, job_id? }`
 *
 * Frontend channel names (`jobs`, `queue:name`, `job:id`) are client-side filters.
 * Subscribe commands map channels onto backend queue/job_id filters when possible.
 */

import { getWsUrl, API_ENDPOINTS } from '@/lib/constants/api';
import type { WebSocketEvent } from '@/lib/types';

type EventCallback = (event: WebSocketEvent) => void;
type ConnectionCallback = () => void;
type ConnectionState =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'degraded'
  | 'offline'
  | 'auth_failed'
  | 'stopped';

interface WebSocketClientOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  maxBackoffMs?: number;
}

const DEFAULT_OPTIONS: Required<WebSocketClientOptions> = {
  reconnectInterval: 1000,
  maxReconnectAttempts: 20,
  heartbeatInterval: 30000,
  maxBackoffMs: 30000,
};

/** Map backend PascalCase / SSE dot names → dashboard event types */
const BACKEND_TYPE_MAP: Record<string, string> = {
  JobStatusChange: 'job.status',
  JobCreated: 'job.created',
  JobCompleted: 'job.completed',
  JobFailed: 'job.failed',
  QueueStats: 'queue.stats',
  WorkerHeartbeat: 'worker.heartbeat',
  WorkerRegistered: 'worker.registered',
  WorkerDeregistered: 'worker.deregistered',
  SystemHealth: 'system.health',
  Ping: 'ping',
  Error: 'error',
  'job.status': 'job.status',
  'job.created': 'job.created',
  'job.completed': 'job.completed',
  'job.failed': 'job.failed',
  'queue.stats': 'queue.stats',
  'worker.heartbeat': 'worker.heartbeat',
  'worker.registered': 'worker.registered',
  'worker.deregistered': 'worker.deregistered',
  'system.health': 'system.health',
  ping: 'ping',
  error: 'error',
};

interface BackendEnvelope {
  type?: string;
  data?: Record<string, unknown>;
}

interface ClientCommand {
  cmd: 'Subscribe' | 'Unsubscribe' | 'Ping';
  queue?: string | null;
  job_id?: string | null;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('token')) {
      u.searchParams.set('token', '[redacted]');
    }
    return u.toString();
  } catch {
    return '[invalid-ws-url]';
  }
}

function parseChannel(channel: string): { queue?: string; jobId?: string } {
  if (channel.startsWith('queue:')) {
    return { queue: channel.slice('queue:'.length) };
  }
  if (channel.startsWith('job:')) {
    return { jobId: channel.slice('job:'.length) };
  }
  if (channel.startsWith('workflow:')) {
    // Backend has no workflow filter; subscribe broadly and filter client-side
    return {};
  }
  // Named aggregate channels (dashboard, jobs, queues, …) → org-wide stream
  return {};
}

function channelMatchesEvent(channel: string, event: WebSocketEvent): boolean {
  if (channel === 'dashboard') {
    return true;
  }
  if (channel === 'jobs') {
    return event.type.startsWith('job.');
  }
  if (channel === 'queues') {
    return event.type.startsWith('queue.');
  }
  if (channel === 'workers') {
    return event.type.startsWith('worker.');
  }
  if (channel === 'workflows') {
    return event.type.startsWith('workflow.');
  }
  if (channel === 'schedules') {
    return event.type.startsWith('schedule.');
  }
  if (channel.startsWith('queue:')) {
    const name = channel.slice('queue:'.length);
    const payload = event.payload as { queue_name?: string };
    return payload?.queue_name === name || event.channel === channel;
  }
  if (channel.startsWith('job:')) {
    const id = channel.slice('job:'.length);
    const payload = event.payload as { job_id?: string };
    return payload?.job_id === id || event.channel === channel;
  }
  if (channel.startsWith('workflow:')) {
    const id = channel.slice('workflow:'.length);
    const payload = event.payload as { workflow_id?: string };
    return payload?.workflow_id === id;
  }
  return false;
}

function normalizeEvent(raw: BackendEnvelope): WebSocketEvent | null {
  if (!raw || typeof raw.type !== 'string') {
    return null;
  }

  const mapped = BACKEND_TYPE_MAP[raw.type] ?? raw.type;
  const data = raw.data && typeof raw.data === 'object' ? raw.data : {};

  let channel = 'dashboard';
  if (typeof data.queue_name === 'string') {
    channel = `queue:${data.queue_name}`;
  } else if (typeof data.job_id === 'string') {
    channel = `job:${data.job_id}`;
  } else if (typeof data.worker_id === 'string') {
    channel = 'workers';
  }

  const timestamp = typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString();

  return {
    type: mapped,
    channel,
    payload: data,
    timestamp,
  };
}

function jitter(ms: number): number {
  const spread = ms * 0.2;
  return Math.max(0, ms + (Math.random() * 2 - 1) * spread);
}

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
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private isManualClose = false;
  private accessToken: string | null = null;
  private connectionState: ConnectionState = 'offline';
  private lastEventAt: string | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private listenersAttached = false;

  constructor(options?: WebSocketClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getUrl(): string {
    return `${getWsUrl()}${API_ENDPOINTS.REALTIME.WS}`;
  }

  private setState(state: ConnectionState) {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.stateListeners.forEach((cb) => cb(state));
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getLastEventAt(): string | null {
    return this.lastEventAt;
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  setAccessToken(token: string | null) {
    const changed = this.accessToken !== token;
    this.accessToken = token;
    if (!token) {
      this.disconnect();
      this.setState('stopped');
      return;
    }
    if (changed) {
      if (
        this.ws &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
      ) {
        this.isManualClose = true;
        this.ws.close();
        this.ws = null;
        this.isManualClose = false;
      }
      this.connect();
    }
  }

  private ensureBrowserListeners() {
    if (typeof window === 'undefined' || this.listenersAttached) return;
    this.listenersAttached = true;

    this.onlineHandler = () => {
      if (this.accessToken && !this.isConnected()) {
        this.reconnectAttempts = 0;
        this.connect();
      }
    };
    this.offlineHandler = () => {
      this.setState('offline');
    };
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.accessToken && !this.isConnected()) {
        this.connect();
      }
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  connect(): void {
    this.ensureBrowserListeners();

    if (!this.accessToken) {
      this.setState('auth_failed');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState('offline');
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isManualClose = false;
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const baseUrl = this.getUrl();
      const wsUrl = `${baseUrl}?token=${encodeURIComponent(this.accessToken)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch {
      this.scheduleReconnect();
    }
  }

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

    this.setState('stopped');
  }

  /**
   * Subscribe to a logical channel. Returns unsubscribe.
   */
  subscribe(channel: string, callback: EventCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSubscribe(channel);
      }
    }

    this.subscriptions.get(channel)!.add(callback);

    return () => {
      const subs = this.subscriptions.get(channel);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(channel);
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendUnsubscribe(channel);
          }
        }
      }
    };
  }

  onEvent(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  onConnect(callback: ConnectionCallback): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  onDisconnect(callback: ConnectionCallback): () => void {
    this.disconnectionListeners.add(callback);
    return () => this.disconnectionListeners.delete(callback);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

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

  /** Test helper — last connection URL with token redacted */
  getRedactedUrl(): string {
    if (!this.ws) return '';
    return redactUrl(this.ws.url);
  }

  private handleOpen() {
    this.reconnectAttempts = 0;
    this.setState('live');
    this.startHeartbeat();

    for (const channel of this.subscriptions.keys()) {
      this.sendSubscribe(channel);
    }

    this.connectionListeners.forEach((cb) => cb());
  }

  private handleMessage(event: MessageEvent) {
    try {
      const raw = JSON.parse(event.data) as BackendEnvelope;
      const normalized = normalizeEvent(raw);
      if (!normalized) {
        return;
      }

      // Ignore keepalive pings for query invalidation; still track liveness
      this.lastEventAt = normalized.timestamp;
      if (normalized.type === 'ping') {
        return;
      }

      this.globalListeners.forEach((cb) => cb(normalized));

      for (const [channel, subs] of this.subscriptions) {
        if (channelMatchesEvent(channel, normalized)) {
          subs.forEach((cb) => cb(normalized));
        }
      }
    } catch {
      // Malformed messages are ignored safely
    }
  }

  private handleClose(event: CloseEvent) {
    this.stopHeartbeat();
    this.ws = null;
    this.disconnectionListeners.forEach((cb) => cb());

    // 4401/1008-ish auth failures — backend currently uses HTTP before upgrade
    if (event.code === 1008 || event.code === 4401 || event.code === 4001) {
      this.setState('auth_failed');
      return;
    }

    if (!this.isManualClose) {
      this.scheduleReconnect();
    } else {
      this.setState('stopped');
    }
  }

  private handleError(_event: Event) {
    // Close handler drives reconnect
  }

  private sendCommand(command: ClientCommand) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    }
  }

  private sendSubscribe(channel: string) {
    const { queue, jobId } = parseChannel(channel);
    // Aggregate channels: no filter → receive org-wide events
    this.sendCommand({
      cmd: 'Subscribe',
      queue: queue ?? null,
      job_id: jobId ?? null,
    });
  }

  private sendUnsubscribe(channel: string) {
    const { queue, jobId } = parseChannel(channel);
    this.sendCommand({
      cmd: 'Unsubscribe',
      queue: queue ?? null,
      job_id: jobId ?? null,
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimeout = setInterval(() => {
      this.sendCommand({ cmd: 'Ping' });
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
      this.setState('degraded');
      return;
    }

    this.reconnectAttempts++;
    this.setState('reconnecting');

    const exponential = this.options.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    const delay = jitter(Math.min(exponential, this.options.maxBackoffMs));

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();

// Channel names (client-side logical channels)
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

export type { ConnectionState };
