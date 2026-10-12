/**
 * The WebSocket client must not open a socket (the access token travels in the URL)
 * until the runtime config has told it which host to use.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen: unknown = null;
  onclose: unknown = null;
  onmessage: unknown = null;
  onerror: unknown = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }
}

let loaded = false;
let resolveLoad: (() => void) | null = null;
let rejectLoad: ((e: Error) => void) | null = null;

vi.mock('@/lib/config/runtime', () => ({
  isConfigLoaded: () => loaded,
  getWsUrl: () => (loaded ? 'wss://api.acme.internal' : 'wss://api.spooled.cloud'),
  loadRuntimeConfig: () =>
    new Promise((resolve, reject) => {
      resolveLoad = () => {
        loaded = true;
        resolve({});
      };
      rejectLoad = reject;
    }),
}));

describe('WebSocket client runtime config gate', () => {
  beforeEach(() => {
    loaded = false;
    resolveLoad = null;
    rejectLoad = null;
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not open a socket before config is loaded, then uses the configured host', async () => {
    const { wsClient } = await import('./client');
    wsClient.setAccessToken('jwt-1');

    expect(MockWebSocket.instances.length).toBe(0);
    expect(wsClient.getConnectionState()).toBe('connecting');

    resolveLoad!();
    await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    expect(MockWebSocket.instances[0].url).toMatch(/^wss:\/\/api\.acme\.internal\//);
    expect(MockWebSocket.instances[0].url).not.toContain('spooled.cloud');
  });

  it('does not connect if the token was cleared while config was loading', async () => {
    const { wsClient } = await import('./client');
    wsClient.setAccessToken('jwt-1');
    wsClient.setAccessToken(null);

    resolveLoad!();
    await Promise.resolve();
    await Promise.resolve();
    expect(MockWebSocket.instances.length).toBe(0);
    expect(wsClient.getConnectionState()).toBe('stopped');
  });

  it('never falls back to the default host when config loading fails', async () => {
    const { wsClient } = await import('./client');
    wsClient.setAccessToken('jwt-1');

    rejectLoad!(new Error('config unavailable'));
    await vi.waitFor(() => expect(wsClient.getConnectionState()).toBe('degraded'));
    expect(MockWebSocket.instances.length).toBe(0);
  });
});
