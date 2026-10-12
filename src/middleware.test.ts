import { describe, it, expect, vi, afterEach } from 'vitest';

// `astro:middleware` only exists inside the Astro build; vitest.config.ts aliases it to a stub.
import { onRequest } from './middleware';

type Handler = (context: { request: Request }, next: () => Promise<Response>) => Promise<Response>;
const handler = onRequest as unknown as Handler;

function run(path: string, headers: Record<string, string>) {
  const next = vi.fn(async () => new Response('page', { status: 200 }));
  // The Node adapter builds request.url as http://localhost/... behind the tunnel.
  const request = new Request(`http://localhost${path}`, { headers });
  return { next, response: handler({ request }, next) };
}

describe('middleware http -> https redirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('redirects http://dashboard.spooled.cloud/... to the same host, not to localhost', async () => {
    const { response, next } = run('/jobs?status=failed', {
      'x-forwarded-proto': 'http',
      host: 'dashboard.spooled.cloud',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dashboard.spooled.cloud/jobs?status=failed');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps a port from the Host header', async () => {
    const { response } = run('/', {
      'x-forwarded-proto': 'http',
      host: 'dashboard.example.com:8443',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dashboard.example.com:8443/');
  });

  it('does not follow a client-supplied X-Forwarded-Host to another site', async () => {
    // The 2026-10-12 review: this used to be a 301 to https://evil.example/jobs.
    const { response, next } = run('/jobs', {
      'x-forwarded-proto': 'http',
      host: 'dashboard.spooled.cloud',
      'x-forwarded-host': 'evil.example',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dashboard.spooled.cloud/jobs');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses X-Forwarded-Host when TRUST_FORWARDED_HOST=true (a proxy that rewrites Host)', async () => {
    vi.stubEnv('TRUST_FORWARDED_HOST', 'true');
    const { response } = run('/queues', {
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'ops.acme.test',
      host: 'dashboard:4321',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://ops.acme.test/queues');
  });

  it('keeps using Host when TRUST_FORWARDED_HOST is not true', async () => {
    vi.stubEnv('TRUST_FORWARDED_HOST', 'false');
    const { response } = run('/queues', {
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'ops.acme.test',
      host: 'dashboard.spooled.cloud',
    });
    const res = await response;
    expect(res.headers.get('location')).toBe('https://dashboard.spooled.cloud/queues');
  });

  it('answers 400 and never redirects when the Host header is malicious', async () => {
    const { response, next } = run('/jobs', {
      'x-forwarded-proto': 'http',
      host: 'evil.example/phish',
    });
    const res = await response;
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects a Host with one trailing dot to the same name without the dot', async () => {
    const { response } = run('/jobs?x=1', {
      'x-forwarded-proto': 'http',
      host: 'dashboard.spooled.cloud.',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dashboard.spooled.cloud/jobs?x=1');
  });

  it('reads the Host port as a number: 0080 is the plain-HTTP port and is dropped', async () => {
    const { response } = run('/', {
      'x-forwarded-proto': 'http',
      host: 'dashboard.example.com:0080',
    });
    const res = await response;
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://dashboard.example.com/');
  });

  it.each([
    ['a comma in Host', 'dashboard.spooled.cloud,evil.example'],
    ['two trailing dots', 'dashboard.spooled.cloud..'],
    ['a hexadecimal port', 'dashboard.spooled.cloud:0x50'],
    ['a port above 65535', 'dashboard.spooled.cloud:65536'],
    ['port 0', 'dashboard.spooled.cloud:0'],
  ])('answers 400, no-store and no Location for %s', async (_label, host) => {
    const { response, next } = run('/jobs', {
      'x-forwarded-proto': 'http',
      host,
      'x-forwarded-host': 'dashboard.spooled.cloud',
    });
    const res = await response;
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 400 for a malicious X-Forwarded-Host when that header is the one in use', async () => {
    vi.stubEnv('TRUST_FORWARDED_HOST', 'true');
    const { response } = run('/jobs', {
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'https://evil.example',
      host: 'dashboard.spooled.cloud',
    });
    const res = await response;
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  it('leaves https requests untouched and still adds the security headers', async () => {
    const { response, next } = run('/jobs', {
      'x-forwarded-proto': 'https',
      host: 'dashboard.spooled.cloud',
    });
    const res = await response;
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('page');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('leaves requests with no forwarded protocol untouched (direct/local access)', async () => {
    const { response, next } = run('/jobs', { host: 'localhost:4321' });
    const res = await response;
    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
