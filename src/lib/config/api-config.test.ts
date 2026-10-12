import { describe, it, expect, afterEach, vi } from 'vitest';
import { GET, resolveWsUrl } from '@/pages/api/config';

describe('/api/config wsUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('derives wss from an https PUBLIC_API_URL when PUBLIC_WS_URL is unset', () => {
    expect(resolveWsUrl('https://api.acme.internal', undefined)).toBe('wss://api.acme.internal');
  });

  it('derives ws (with port) from an http PUBLIC_API_URL', () => {
    expect(resolveWsUrl('http://localhost:8080', '')).toBe('ws://localhost:8080');
  });

  it('prefers an explicit PUBLIC_WS_URL', () => {
    expect(resolveWsUrl('https://api.acme.internal', 'wss://rt.acme.internal')).toBe(
      'wss://rt.acme.internal'
    );
  });

  it('falls back to the hosted default only when nothing is configured', () => {
    expect(resolveWsUrl(undefined, undefined)).toBe('wss://api.spooled.cloud');
  });

  it('GET never pairs a custom apiUrl with the hosted wsUrl', async () => {
    vi.stubEnv('PUBLIC_API_URL', 'https://api.acme.internal');
    vi.stubEnv('PUBLIC_WS_URL', '');
    const res = await (GET as unknown as () => Response | Promise<Response>)();
    const body = (await res.json()) as { apiUrl: string; wsUrl: string };
    expect(body.apiUrl).toBe('https://api.acme.internal');
    expect(body.wsUrl).toBe('wss://api.acme.internal');
  });
});
