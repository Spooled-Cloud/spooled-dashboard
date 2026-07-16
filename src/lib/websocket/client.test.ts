/**
 * Comprehensive Tests for WebSocket Client
 *
 * Uses a MockWebSocket class to simulate WebSocket behavior
 * and test all client functionality including:
 * - Connection lifecycle
 * - Backend-aligned command/event protocol
 * - Subscription management
 * - Heartbeat mechanism
 * - Reconnection logic
 * - Malformed message handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { WS_CHANNELS } from './client';

const TEST_TOKEN = 'test-access-token';

// Mock WebSocket class that allows full control over the connection
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((this: WebSocket, ev: Event) => void) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
  onerror: ((this: WebSocket, ev: Event) => void) | null = null;
  sentMessages: string[] = [];
  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      const event = { code: code || 1000, reason: reason || '' } as CloseEvent;
      this.onclose.call(this as unknown as WebSocket, event);
    }
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen.call(this as unknown as WebSocket, new Event('open'));
    }
  }

  simulateMessage(data: object) {
    if (this.onmessage) {
      const event = { data: JSON.stringify(data) } as MessageEvent;
      this.onmessage.call(this as unknown as WebSocket, event);
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror.call(this as unknown as WebSocket, new Event('error'));
    }
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      const event = { code, reason } as CloseEvent;
      this.onclose.call(this as unknown as WebSocket, event);
    }
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  static getLatestInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

function parseSent(ws: MockWebSocket | undefined) {
  return ws?.sentMessages.map((m) => JSON.parse(m)) ?? [];
}

function backendJobCreated(overrides: Record<string, unknown> = {}) {
  return {
    type: 'JobCreated',
    data: {
      job_id: 'job-1',
      queue_name: 'emails',
      timestamp: '2024-01-01T12:00:00Z',
      ...overrides,
    },
  };
}

function normalizedJobCreated(overrides: Record<string, unknown> = {}) {
  const data = {
    job_id: 'job-1',
    queue_name: 'emails',
    timestamp: '2024-01-01T12:00:00Z',
    ...overrides,
  };
  return {
    type: 'job.created',
    channel: 'queue:emails',
    payload: data,
    timestamp: data.timestamp as string,
  };
}

describe('WebSocket Client', () => {
  let consoleSpy: {
    log: Mock;
    error: Mock;
  };
  let randomSpy: Mock;

  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal('WebSocket', MockWebSocket);

    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Deterministic reconnect backoff (no jitter)
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    randomSpy.mockRestore();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function createFreshClient() {
    vi.resetModules();
    const module = await import('./client');
    return module.wsClient;
  }

  async function connectClient(token: string = TEST_TOKEN) {
    const client = await createFreshClient();
    client.setAccessToken(token);
    return client;
  }

  describe('WS_CHANNELS constants', () => {
    it('should have DASHBOARD channel', () => {
      expect(WS_CHANNELS.DASHBOARD).toBe('dashboard');
    });

    it('should have JOBS channel', () => {
      expect(WS_CHANNELS.JOBS).toBe('jobs');
    });

    it('should have QUEUES channel', () => {
      expect(WS_CHANNELS.QUEUES).toBe('queues');
    });

    it('should have WORKERS channel', () => {
      expect(WS_CHANNELS.WORKERS).toBe('workers');
    });

    it('should have WORKFLOWS channel', () => {
      expect(WS_CHANNELS.WORKFLOWS).toBe('workflows');
    });

    it('should generate queue channel names', () => {
      expect(WS_CHANNELS.queue('default')).toBe('queue:default');
      expect(WS_CHANNELS.queue('emails')).toBe('queue:emails');
    });

    it('should generate job channel names', () => {
      expect(WS_CHANNELS.job('job-123')).toBe('job:job-123');
    });

    it('should generate workflow channel names', () => {
      expect(WS_CHANNELS.workflow('workflow-1')).toBe('workflow:workflow-1');
    });
  });

  describe('Connection Lifecycle', () => {
    it('should create WebSocket connection when token is set', async () => {
      const client = await connectClient();

      expect(MockWebSocket.instances.length).toBe(1);
      expect(client.getState()).toBe('connecting');
      expect(client.getConnectionState()).toBe('connecting');
    });

    it('should include token in URL when set', async () => {
      await connectClient('my-token-123');

      const ws = MockWebSocket.getLatestInstance();
      expect(ws?.url).toContain('token=my-token-123');
    });

    it('should not create connection without token', async () => {
      const client = await createFreshClient();

      client.setAccessToken(null);
      client.connect();

      expect(MockWebSocket.instances.length).toBe(0);
      expect(client.getConnectionState()).toBe('auth_failed');
    });

    it('should update state to live when connection opens', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(client.isConnected()).toBe(true);
      expect(client.getState()).toBe('open');
      expect(client.getConnectionState()).toBe('live');
    });

    it('should not create duplicate connections if already connected', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.connect();

      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('should not create connection if already connecting', async () => {
      const client = await connectClient();
      client.connect();

      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('should disconnect and update state', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getState()).toBe('closed');
      expect(client.getConnectionState()).toBe('stopped');
    });

    it('should redact token in getRedactedUrl()', async () => {
      const client = await connectClient('secret-token-value');

      const ws = MockWebSocket.getLatestInstance();
      expect(ws?.url).toContain('secret-token-value');
      expect(client.getRedactedUrl()).toContain('token=%5Bredacted%5D');
      expect(client.getRedactedUrl()).not.toContain('secret-token-value');
    });
  });

  describe('Connection Listeners', () => {
    it('should call onConnect listeners when connection opens', async () => {
      const client = await connectClient();
      const callback = vi.fn();

      client.onConnect(callback);
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should call onDisconnect listeners when connection closes', async () => {
      const client = await connectClient();
      const callback = vi.fn();

      client.onDisconnect(callback);
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateClose();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should notify state listeners on connection state changes', async () => {
      const client = await connectClient();
      const states: string[] = [];

      client.onStateChange((state) => states.push(state));
      MockWebSocket.getLatestInstance()?.simulateOpen();
      client.disconnect();

      expect(states).toContain('live');
      expect(states).toContain('stopped');
    });

    it('should allow unsubscribing from connection events', async () => {
      const client = await connectClient();
      const callback = vi.fn();

      const unsubscribe = client.onConnect(callback);
      unsubscribe();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should normalize backend events for global listeners', async () => {
      const client = await connectClient();
      const callback = vi.fn();

      client.onEvent(callback);
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateMessage(backendJobCreated());

      expect(callback).toHaveBeenCalledWith(normalizedJobCreated());
    });

    it('should dispatch normalized events to channel subscribers', async () => {
      const client = await connectClient();
      const channelCallback = vi.fn();

      client.subscribe('jobs', channelCallback);
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateMessage(backendJobCreated());

      expect(channelCallback).toHaveBeenCalledWith(normalizedJobCreated());
    });

    it('should not dispatch messages to wrong channel subscribers', async () => {
      const client = await connectClient();
      const jobsCallback = vi.fn();
      const queuesCallback = vi.fn();

      client.subscribe('jobs', jobsCallback);
      client.subscribe('queues', queuesCallback);
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateMessage(backendJobCreated());

      expect(jobsCallback).toHaveBeenCalledOnce();
      expect(queuesCallback).not.toHaveBeenCalled();
    });

    it('should not dispatch Ping events to listeners', async () => {
      const client = await connectClient();
      const globalCallback = vi.fn();
      const channelCallback = vi.fn();

      client.onEvent(globalCallback);
      client.subscribe('dashboard', channelCallback);
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateMessage({
        type: 'Ping',
        data: { timestamp: '2024-01-01T12:00:01Z' },
      });

      expect(globalCallback).not.toHaveBeenCalled();
      expect(channelCallback).not.toHaveBeenCalled();
      expect(client.getLastEventAt()).toBe('2024-01-01T12:00:01Z');
    });

    it('should handle invalid JSON gracefully', async () => {
      await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const ws = MockWebSocket.getLatestInstance();
      expect(() => {
        if (ws?.onmessage) {
          ws.onmessage.call(ws as unknown as WebSocket, { data: 'not-valid-json' } as MessageEvent);
        }
      }).not.toThrow();
    });

    it('should ignore malformed messages without type', async () => {
      const client = await connectClient();
      const callback = vi.fn();

      client.onEvent(callback);
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateMessage({ data: { job_id: 'x' } });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    it('should send Subscribe with null filters for aggregate jobs channel', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('jobs', vi.fn());

      const messages = parseSent(MockWebSocket.getLatestInstance());
      expect(messages).toContainEqual({
        cmd: 'Subscribe',
        queue: null,
        job_id: null,
      });
    });

    it('should send Subscribe with queue filter for queue channels', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('queue:emails', vi.fn());

      const messages = parseSent(MockWebSocket.getLatestInstance());
      expect(messages).toContainEqual({
        cmd: 'Subscribe',
        queue: 'emails',
        job_id: null,
      });
    });

    it('should send Subscribe with job_id filter for job channels', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('job:uuid-123', vi.fn());

      const messages = parseSent(MockWebSocket.getLatestInstance());
      expect(messages).toContainEqual({
        cmd: 'Subscribe',
        queue: null,
        job_id: 'uuid-123',
      });
    });

    it('should not send duplicate Subscribe for same channel', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('jobs', vi.fn());
      client.subscribe('jobs', vi.fn());

      const subscribeMessages = parseSent(MockWebSocket.getLatestInstance()).filter(
        (m: { cmd: string; queue?: string | null; job_id?: string | null }) =>
          m.cmd === 'Subscribe' && m.queue === null && m.job_id === null
      );

      expect(subscribeMessages.length).toBe(1);
    });

    it('should send Unsubscribe when last subscriber leaves', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const unsub = client.subscribe('jobs', vi.fn());
      unsub();

      const messages = parseSent(MockWebSocket.getLatestInstance());
      expect(messages).toContainEqual({
        cmd: 'Unsubscribe',
        queue: null,
        job_id: null,
      });
    });

    it('should not send Unsubscribe if other subscribers remain', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const unsub1 = client.subscribe('jobs', vi.fn());
      client.subscribe('jobs', vi.fn());
      unsub1();

      const unsubMessages = parseSent(MockWebSocket.getLatestInstance()).filter(
        (m: { cmd: string }) => m.cmd === 'Unsubscribe'
      );

      expect(unsubMessages.length).toBe(0);
    });

    it('should re-subscribe to all channels on reconnect', async () => {
      const client = await connectClient();

      client.subscribe('jobs', vi.fn());
      client.subscribe('queue:emails', vi.fn());

      MockWebSocket.getLatestInstance()?.simulateOpen();

      const subscribeMessages = parseSent(MockWebSocket.getLatestInstance()).filter(
        (m: { cmd: string }) => m.cmd === 'Subscribe'
      );

      expect(subscribeMessages.length).toBe(2);
      expect(subscribeMessages).toContainEqual({
        cmd: 'Subscribe',
        queue: null,
        job_id: null,
      });
      expect(subscribeMessages).toContainEqual({
        cmd: 'Subscribe',
        queue: 'emails',
        job_id: null,
      });
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should start sending Ping commands after connection', async () => {
      await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      vi.advanceTimersByTime(30000);

      const pingMessages = parseSent(MockWebSocket.getLatestInstance()).filter(
        (m: { cmd: string }) => m.cmd === 'Ping'
      );

      expect(pingMessages.length).toBe(1);
      expect(pingMessages[0]).toEqual({ cmd: 'Ping' });
    });

    it('should send multiple heartbeats over time', async () => {
      await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      vi.advanceTimersByTime(90000);

      const pingMessages = parseSent(MockWebSocket.getLatestInstance()).filter(
        (m: { cmd: string }) => m.cmd === 'Ping'
      );

      expect(pingMessages.length).toBe(3);
    });

    it('should stop heartbeat on disconnect', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.disconnect();
      vi.advanceTimersByTime(60000);

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt to reconnect after unexpected disconnect', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Connection lost');

      vi.advanceTimersByTime(1000);

      expect(MockWebSocket.instances.length).toBe(2);
      expect(client.getConnectionState()).toBe('reconnecting');
    });

    it('should not reconnect after manual disconnect', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      client.disconnect();

      vi.advanceTimersByTime(10000);

      expect(MockWebSocket.instances.length).toBe(1);
      expect(client.getConnectionState()).toBe('stopped');
    });

    it('should use exponential backoff for reconnection', async () => {
      await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances.length).toBe(2);

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(1500);
      expect(MockWebSocket.instances.length).toBe(3);

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(2250);
      expect(MockWebSocket.instances.length).toBe(4);
    });

    it('should stop reconnecting after max attempts and enter degraded state', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(MockWebSocket.instances.length).toBe(1);

      for (let i = 0; i < 25; i++) {
        MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
        vi.advanceTimersByTime(100000);
      }

      const instancesAfterMaxAttempts = MockWebSocket.instances.length;

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(100000);

      expect(MockWebSocket.instances.length).toBe(instancesAfterMaxAttempts);
      expect(client.getConnectionState()).toBe('degraded');
    });

    it('should reset reconnect attempts after successful connection', async () => {
      await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(1000);
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(1000);

      expect(MockWebSocket.instances.length).toBe(3);
    });

    it('should set auth_failed on auth close codes', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateClose(4401, 'Unauthorized');

      expect(client.getConnectionState()).toBe('auth_failed');
      expect(MockWebSocket.instances.length).toBe(1);
    });
  });

  describe('Token Updates', () => {
    it('should reconnect with new token when token is updated while connected', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(MockWebSocket.instances.length).toBe(1);

      client.setAccessToken('new-token');

      expect(MockWebSocket.instances.length).toBe(2);
      expect(MockWebSocket.getLatestInstance()?.url).toContain('token=new-token');
    });

    it('should reconnect with latest token when token changes before connection opens', async () => {
      const client = await createFreshClient();
      client.setAccessToken('token-1');
      client.setAccessToken('token-2');

      // Closes in-flight socket and opens a new one with the latest token
      expect(MockWebSocket.instances.length).toBe(2);
      expect(MockWebSocket.getLatestInstance()?.url).toContain('token=token-2');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors gracefully', async () => {
      await connectClient();

      expect(() => {
        MockWebSocket.getLatestInstance()?.simulateError();
      }).not.toThrow();
    });
  });

  describe('getState()', () => {
    it('should return closed when no connection', async () => {
      const client = await createFreshClient();
      expect(client.getState()).toBe('closed');
    });

    it('should return connecting during connection', async () => {
      const client = await connectClient();
      expect(client.getState()).toBe('connecting');
    });

    it('should return open when connected', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      expect(client.getState()).toBe('open');
    });

    it('should return closed after disconnect', async () => {
      const client = await connectClient();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      client.disconnect();
      expect(client.getState()).toBe('closed');
    });
  });
});
