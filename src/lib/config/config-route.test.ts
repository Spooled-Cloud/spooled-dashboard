/**
 * Tests for the runtime configuration endpoint (GET /api/config, src/pages/api/config.ts).
 *
 * This file lives outside src/pages on purpose: Astro turns every module under src/pages into a
 * route, so a test there was built as GET /api/config.test (a 500 with a vitest stack trace).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GET, resolveWsUrl, type RuntimeConfig } from '@/pages/api/config';

const HOSTED_API = 'https://api.spooled.cloud';
const HOSTED_WS = 'wss://api.spooled.cloud';

function setEnv(values: { PUBLIC_API_URL?: string; PUBLIC_WS_URL?: string }) {
  // An undefined value removes the variable for the duration of the test.
  vi.stubEnv('PUBLIC_API_URL', values.PUBLIC_API_URL);
  vi.stubEnv('PUBLIC_WS_URL', values.PUBLIC_WS_URL);
}

async function readConfig(): Promise<RuntimeConfig> {
  const response = await (GET as unknown as () => Response | Promise<Response>)();
  return (await response.json()) as RuntimeConfig;
}

describe('resolveWsUrl', () => {
  it('keeps the hosted WebSocket host when neither URL is set', () => {
    expect(resolveWsUrl(undefined, undefined)).toBe(HOSTED_WS);
  });

  it('keeps the hosted WebSocket host for the hosted API with or without an explicit WS URL', () => {
    expect(resolveWsUrl(HOSTED_API, undefined)).toBe(HOSTED_WS);
    expect(resolveWsUrl(HOSTED_API, HOSTED_WS)).toBe(HOSTED_WS);
  });

  it('derives the WebSocket URL from a self-hosted API URL', () => {
    expect(resolveWsUrl('https://api.example.com', undefined)).toBe('wss://api.example.com');
    expect(resolveWsUrl('http://localhost:3000', undefined)).toBe('ws://localhost:3000');
  });

  it('lets an explicit custom PUBLIC_WS_URL win', () => {
    expect(resolveWsUrl('https://api.example.com', 'wss://realtime.example.com')).toBe(
      'wss://realtime.example.com'
    );
    expect(resolveWsUrl(undefined, 'wss://realtime.example.com')).toBe(
      'wss://realtime.example.com'
    );
  });

  it('treats the hosted default WS URL as unset when the API URL is a non-default host', () => {
    // The shipped image / compose file / base manifest used to bake in the hosted WS URL,
    // so a deployment that only set PUBLIC_API_URL sent session tokens to the hosted host.
    expect(resolveWsUrl('https://api.example.com', HOSTED_WS)).toBe('wss://api.example.com');
    expect(resolveWsUrl('http://localhost:3000', `${HOSTED_WS}/`)).toBe('ws://localhost:3000');
    expect(resolveWsUrl('https://api.example.com', 'WSS://API.SPOOLED.CLOUD')).toBe(
      'wss://api.example.com'
    );
  });
});

describe('GET /api/config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the hosted API and WebSocket hosts when no PUBLIC_* URL is set', async () => {
    setEnv({});
    const config = await readConfig();
    expect(config.apiUrl).toBe(HOSTED_API);
    expect(config.wsUrl).toBe(HOSTED_WS);
  });

  it('derives wsUrl from PUBLIC_API_URL when the image default WS URL is still present', async () => {
    setEnv({ PUBLIC_API_URL: 'https://api.selfhosted.test', PUBLIC_WS_URL: HOSTED_WS });
    const config = await readConfig();
    expect(config.apiUrl).toBe('https://api.selfhosted.test');
    expect(config.wsUrl).toBe('wss://api.selfhosted.test');
  });

  it('serves a custom PUBLIC_WS_URL unchanged', async () => {
    setEnv({
      PUBLIC_API_URL: 'https://api.selfhosted.test',
      PUBLIC_WS_URL: 'wss://ws.selfhosted.test',
    });
    const config = await readConfig();
    expect(config.wsUrl).toBe('wss://ws.selfhosted.test');
  });

  it('serves the hosted pair when the hosted URLs are set explicitly (production)', async () => {
    setEnv({ PUBLIC_API_URL: HOSTED_API, PUBLIC_WS_URL: HOSTED_WS });
    const config = await readConfig();
    expect(config.apiUrl).toBe(HOSTED_API);
    expect(config.wsUrl).toBe(HOSTED_WS);
  });
});

describe('shipped deployment defaults', () => {
  const root = resolve(__dirname, '../../..');
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

  it('the Dockerfile does not bake in the hosted PUBLIC_WS_URL', () => {
    expect(read('Dockerfile')).not.toMatch(/^\s*ENV\s+PUBLIC_WS_URL\b/m);
  });

  it('docker-compose.prod.yml defaults PUBLIC_WS_URL to empty, not the hosted host', () => {
    const compose = read('docker-compose.prod.yml');
    expect(compose).toMatch(/PUBLIC_WS_URL:\s*\$\{PUBLIC_WS_URL:-\}/);
    expect(compose).not.toMatch(/PUBLIC_WS_URL:\s*\$\{PUBLIC_WS_URL:-wss:/);
  });

  it('the k8s base configmap does not set PUBLIC_WS_URL', () => {
    expect(read('k8s/base/configmap.yaml')).not.toMatch(/^\s*PUBLIC_WS_URL\s*:/m);
  });
});
