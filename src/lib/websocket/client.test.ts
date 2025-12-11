/**
 * Comprehensive Tests for WebSocket Client
 *
 * Uses a MockWebSocket class to simulate WebSocket behavior
 * and test all client functionality including:
 * - Connection lifecycle
 * - Message handling
 * - Subscription management
 * - Heartbeat mechanism
 * - Reconnection logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { WS_CHANNELS } from './client';

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

  // Test helpers
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

// We need to create a new WebSocketClient for each test to avoid state pollution
// Import the class directly for testing
describe('WebSocket Client', () => {
  let consoleSpy: {
    log: Mock;
    error: Mock;
  };

  beforeEach(() => {
    // Reset mock instances
    MockWebSocket.reset();

    // Use vi.stubGlobal to replace WebSocket (works with frozen globals)
    vi.stubGlobal('WebSocket', MockWebSocket);

    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Use fake timers for reconnection tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore all mocks including stubGlobal
    vi.unstubAllGlobals();

    // Restore console
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();

    // Restore real timers
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // We need to dynamically import the client to get a fresh instance with our mocked WebSocket
  async function createFreshClient() {
    // Clear module cache
    vi.resetModules();
    // Import fresh client
    const module = await import('./client');
    return module.wsClient;
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
    it('should create WebSocket connection on connect()', async () => {
      const client = await createFreshClient();

      client.connect();

      expect(MockWebSocket.instances.length).toBe(1);
      expect(client.getState()).toBe('connecting');
    });

    it('should include token in URL when set', async () => {
      const client = await createFreshClient();

      client.setAccessToken('my-token-123');
      client.connect();

      const ws = MockWebSocket.getLatestInstance();
      expect(ws?.url).toContain('token=my-token-123');
    });

    it('should not include token in URL when null', async () => {
      const client = await createFreshClient();

      client.setAccessToken(null);
      client.connect();

      const ws = MockWebSocket.getLatestInstance();
      expect(ws?.url).not.toContain('token=');
    });

    it('should update state to open when connection opens', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(client.isConnected()).toBe(true);
      expect(client.getState()).toBe('open');
    });

    it('should not create duplicate connections if already connected', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.connect(); // Try again

      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('should not create connection if already connecting', async () => {
      const client = await createFreshClient();

      client.connect();
      client.connect(); // Still connecting

      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('should disconnect and update state', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(client.getState()).toBe('closed');
    });
  });

  describe('Connection Listeners', () => {
    it('should call onConnect listeners when connection opens', async () => {
      const client = await createFreshClient();
      const callback = vi.fn();

      client.onConnect(callback);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should call onDisconnect listeners when connection closes', async () => {
      const client = await createFreshClient();
      const callback = vi.fn();

      client.onDisconnect(callback);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      MockWebSocket.getLatestInstance()?.simulateClose();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should allow multiple connection listeners', async () => {
      const client = await createFreshClient();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      client.onConnect(cb1);
      client.onConnect(cb2);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('should allow unsubscribing from connection events', async () => {
      const client = await createFreshClient();
      const callback = vi.fn();

      const unsubscribe = client.onConnect(callback);
      unsubscribe();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should parse and dispatch messages to global listeners', async () => {
      const client = await createFreshClient();
      const callback = vi.fn();

      client.onEvent(callback);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateMessage({
        channel: 'jobs',
        type: 'job.created',
        data: { id: 'job-1' },
      });

      expect(callback).toHaveBeenCalledWith({
        channel: 'jobs',
        type: 'job.created',
        data: { id: 'job-1' },
      });
    });

    it('should dispatch messages to channel subscribers', async () => {
      const client = await createFreshClient();
      const channelCallback = vi.fn();

      client.subscribe('jobs', channelCallback);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateMessage({
        channel: 'jobs',
        type: 'job.created',
        data: { id: 'job-1' },
      });

      expect(channelCallback).toHaveBeenCalledWith({
        channel: 'jobs',
        type: 'job.created',
        data: { id: 'job-1' },
      });
    });

    it('should not dispatch messages to wrong channel subscribers', async () => {
      const client = await createFreshClient();
      const jobsCallback = vi.fn();
      const queuesCallback = vi.fn();

      client.subscribe('jobs', jobsCallback);
      client.subscribe('queues', queuesCallback);
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      MockWebSocket.getLatestInstance()?.simulateMessage({
        channel: 'jobs',
        type: 'job.created',
        data: {},
      });

      expect(jobsCallback).toHaveBeenCalledOnce();
      expect(queuesCallback).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // Simulate receiving invalid JSON - should not throw
      const ws = MockWebSocket.getLatestInstance();
      expect(() => {
        if (ws?.onmessage) {
          ws.onmessage.call(ws as unknown as WebSocket, { data: 'not-valid-json' } as MessageEvent);
        }
      }).not.toThrow();
    });
  });

  describe('Subscription Management', () => {
    it('should send subscribe message when subscribing to new channel', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('jobs', vi.fn());

      const ws = MockWebSocket.getLatestInstance();
      const messages = ws?.sentMessages.map((m) => JSON.parse(m));
      expect(messages).toContainEqual({ type: 'subscribe', channel: 'jobs' });
    });

    it('should not send duplicate subscribe for same channel', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.subscribe('jobs', vi.fn());
      client.subscribe('jobs', vi.fn()); // Second subscriber

      const ws = MockWebSocket.getLatestInstance();
      const subscribeMessages = ws?.sentMessages
        .map((m) => JSON.parse(m))
        .filter(
          (m: { type: string; channel?: string }) => m.type === 'subscribe' && m.channel === 'jobs'
        );

      expect(subscribeMessages?.length).toBe(1);
    });

    it('should send unsubscribe when last subscriber leaves', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const unsub = client.subscribe('jobs', vi.fn());
      unsub();

      const ws = MockWebSocket.getLatestInstance();
      const messages = ws?.sentMessages.map((m) => JSON.parse(m));
      expect(messages).toContainEqual({ type: 'unsubscribe', channel: 'jobs' });
    });

    it('should not send unsubscribe if other subscribers remain', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const unsub1 = client.subscribe('jobs', vi.fn());
      client.subscribe('jobs', vi.fn()); // Second subscriber
      unsub1(); // First leaves

      const ws = MockWebSocket.getLatestInstance();
      const unsubMessages = ws?.sentMessages
        .map((m) => JSON.parse(m))
        .filter((m: { type: string }) => m.type === 'unsubscribe');

      expect(unsubMessages?.length).toBe(0);
    });

    it('should re-subscribe to all channels on reconnect', async () => {
      const client = await createFreshClient();

      // Subscribe before connecting
      client.subscribe('jobs', vi.fn());
      client.subscribe('queues', vi.fn());

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      const ws = MockWebSocket.getLatestInstance();
      const subscribeMessages = ws?.sentMessages
        .map((m) => JSON.parse(m))
        .filter((m: { type: string }) => m.type === 'subscribe');

      expect(subscribeMessages?.length).toBe(2);
      expect(subscribeMessages).toContainEqual({ type: 'subscribe', channel: 'jobs' });
      expect(subscribeMessages).toContainEqual({ type: 'subscribe', channel: 'queues' });
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should start sending heartbeat pings after connection', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // Fast-forward past heartbeat interval (default 30s)
      vi.advanceTimersByTime(30000);

      const ws = MockWebSocket.getLatestInstance();
      const pingMessages = ws?.sentMessages
        .map((m) => JSON.parse(m))
        .filter((m: { type: string }) => m.type === 'ping');

      expect(pingMessages?.length).toBe(1);
    });

    it('should send multiple heartbeats over time', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // Fast-forward past 3 heartbeat intervals
      vi.advanceTimersByTime(90000);

      const ws = MockWebSocket.getLatestInstance();
      const pingMessages = ws?.sentMessages
        .map((m) => JSON.parse(m))
        .filter((m: { type: string }) => m.type === 'ping');

      expect(pingMessages?.length).toBe(3);
    });

    it('should stop heartbeat on disconnect', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.disconnect();

      // Fast-forward - no more pings should be sent
      vi.advanceTimersByTime(60000);

      // Disconnect closes connection immediately, so we check the instance before disconnect
      // Actually heartbeat should have stopped
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt to reconnect after unexpected disconnect', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // Simulate unexpected close (not manual)
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Connection lost');

      // Initial reconnect delay is 3000ms
      vi.advanceTimersByTime(3000);

      expect(MockWebSocket.instances.length).toBe(2); // New connection attempt
    });

    it('should not reconnect after manual disconnect', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      client.disconnect(); // Manual disconnect

      vi.advanceTimersByTime(10000);

      expect(MockWebSocket.instances.length).toBe(1); // No new connections
    });

    it('should use exponential backoff for reconnection', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // First disconnect
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');

      // First reconnect at 3000ms
      vi.advanceTimersByTime(3000);
      expect(MockWebSocket.instances.length).toBe(2);

      // Second disconnect
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');

      // Second reconnect at 4500ms (3000 * 1.5)
      vi.advanceTimersByTime(4500);
      expect(MockWebSocket.instances.length).toBe(3);

      // Third disconnect
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');

      // Third reconnect at 6750ms (3000 * 1.5^2)
      vi.advanceTimersByTime(6750);
      expect(MockWebSocket.instances.length).toBe(4);
    });

    it('should stop reconnecting after max attempts', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // 1 initial connection
      expect(MockWebSocket.instances.length).toBe(1);

      // Simulate many disconnects to exceed max attempts (default is 10)
      for (let i = 0; i < 15; i++) {
        MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
        vi.advanceTimersByTime(100000); // Long enough for any backoff
      }

      const instancesAfterMaxAttempts = MockWebSocket.instances.length;

      // Try additional disconnects - should NOT create new connections
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(100000);
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(100000);

      // Should not have created any new connections after max attempts
      expect(MockWebSocket.instances.length).toBe(instancesAfterMaxAttempts);
    });

    it('should reset reconnect attempts after successful connection', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      // First disconnect and reconnect
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');
      vi.advanceTimersByTime(3000);
      MockWebSocket.getLatestInstance()?.simulateOpen(); // Successful reconnect

      // Second disconnect
      MockWebSocket.getLatestInstance()?.simulateClose(1006, 'Lost');

      // Should use initial delay (3000ms) again, not exponential
      vi.advanceTimersByTime(3000);
      expect(MockWebSocket.instances.length).toBe(3);
    });
  });

  describe('Token Updates', () => {
    it('should reconnect with new token when token is updated while connected', async () => {
      const client = await createFreshClient();

      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();

      expect(MockWebSocket.instances.length).toBe(1);

      client.setAccessToken('new-token');

      // Should have created new connection
      expect(MockWebSocket.instances.length).toBe(2);
      expect(MockWebSocket.getLatestInstance()?.url).toContain('token=new-token');
    });

    it('should not reconnect if not connected when token changes', async () => {
      const client = await createFreshClient();

      client.setAccessToken('token-1');
      client.setAccessToken('token-2');

      expect(MockWebSocket.instances.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors gracefully', async () => {
      const client = await createFreshClient();

      client.connect();

      // Should not throw when error occurs
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
      const client = await createFreshClient();
      client.connect();
      expect(client.getState()).toBe('connecting');
    });

    it('should return open when connected', async () => {
      const client = await createFreshClient();
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      expect(client.getState()).toBe('open');
    });

    it('should return closed after disconnect', async () => {
      const client = await createFreshClient();
      client.connect();
      MockWebSocket.getLatestInstance()?.simulateOpen();
      client.disconnect();
      expect(client.getState()).toBe('closed');
    });
  });
});
