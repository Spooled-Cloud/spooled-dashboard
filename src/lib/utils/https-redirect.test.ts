import { describe, it, expect } from 'vitest';
import {
  isPlainHttpRequest,
  parsePublicHost,
  resolveHttpsRedirect,
  trustForwardedHostFromEnv,
} from './https-redirect';

/** The Node adapter hands the middleware `http://localhost/...` whatever the client asked for. */
function req(path: string, headers: Record<string, string>): Request {
  return new Request(`http://localhost${path}`, { headers });
}

describe('parsePublicHost', () => {
  it.each([
    ['dashboard.spooled.cloud', 'dashboard.spooled.cloud'],
    ['Dashboard.Spooled.Cloud', 'dashboard.spooled.cloud'],
    ['  dashboard.spooled.cloud  ', 'dashboard.spooled.cloud'],
    ['dashboard.example.com:8443', 'dashboard.example.com:8443'],
    ['localhost:4321', 'localhost:4321'],
    ['192.168.1.20:8080', '192.168.1.20:8080'],
    ['[::1]:8443', '[::1]:8443'],
    ['[::1]', '[::1]'],
    ['my_host.internal', 'my_host.internal'],
    // Default ports carry no meaning for an https:// URL.
    ['dashboard.example.com:443', 'dashboard.example.com'],
    ['dashboard.example.com:80', 'dashboard.example.com'],
  ])('accepts %s', (input, expected) => {
    expect(parsePublicHost(input)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['a scheme', 'https://evil.example'],
    ['a scheme without slashes', 'javascript:alert(1)'],
    ['a path', 'evil.example/path'],
    ['a path after the port', 'evil.example:8443/path'],
    ['a query', 'evil.example?x=1'],
    ['a fragment', 'evil.example#x'],
    ['userinfo', 'user@evil.example'],
    ['userinfo with password', 'user:pass@evil.example'],
    ['a space inside', 'evil.example evil2.example'],
    ['a backslash', 'evil.example\\@dashboard.example'],
    ['a comma list', 'a.example,b.example'],
    ['an empty port', 'evil.example:'],
    ['port 0', 'evil.example:0'],
    ['a port above 65535', 'evil.example:65536'],
    ['a non-numeric port', 'evil.example:http'],
    ['two ports', 'evil.example:80:80'],
    ['a trailing dot', 'evil.example.'],
    ['an empty label', 'evil..example'],
    ['a leading hyphen', '-evil.example'],
    ['a label over 63 characters', `${'a'.repeat(64)}.example`],
    ['a name over 253 characters', `${'a'.repeat(60)}.`.repeat(5) + 'example'],
    ['non-ASCII characters', 'dashboard.exämple.com'],
    ['a percent escape', 'evil%2eexample'],
    ['a control character', 'evil.example\r\nX-Injected: 1'],
    ['an out-of-range IPv4', '999.1.1.1'],
    ['a hex IPv4 the URL parser would rewrite', '0x7f.1'],
    ['an unterminated IPv6 literal', '[::1'],
    ['an invalid IPv6 literal', '[zz::1]'],
    ['an IPv6 literal with a path', '[::1]/x'],
  ])('rejects %s', (_label, input) => {
    expect(parsePublicHost(input)).toBeNull();
  });

  it('rejects missing values', () => {
    expect(parsePublicHost(null)).toBeNull();
    expect(parsePublicHost(undefined)).toBeNull();
  });
});

describe('isPlainHttpRequest', () => {
  it('is true only when the proxy reports http', () => {
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': 'http' }))).toBe(true);
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': 'HTTP' }))).toBe(true);
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': ' http ' }))).toBe(true);
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': 'https' }))).toBe(false);
    expect(isPlainHttpRequest(new Headers())).toBe(false);
  });

  it('uses the first hop of a proxy chain', () => {
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': 'http,https' }))).toBe(true);
    expect(isPlainHttpRequest(new Headers({ 'x-forwarded-proto': 'https,http' }))).toBe(false);
  });
});

describe('resolveHttpsRedirect', () => {
  it('redirects to the host the client asked for, not to localhost', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', { 'x-forwarded-proto': 'http', host: 'dashboard.spooled.cloud' })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard.spooled.cloud/jobs' });
  });

  it('keeps the path and query string', () => {
    const result = resolveHttpsRedirect(
      req('/jobs?status=failed&page=2', {
        'x-forwarded-proto': 'http',
        host: 'dashboard.spooled.cloud',
      })
    );
    expect(result).toEqual({
      kind: 'redirect',
      location: 'https://dashboard.spooled.cloud/jobs?status=failed&page=2',
    });
  });

  it('redirects the root path', () => {
    const result = resolveHttpsRedirect(
      req('/', { 'x-forwarded-proto': 'http', host: 'dashboard.spooled.cloud' })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard.spooled.cloud/' });
  });

  it('keeps a non-default port from the Host header', () => {
    const result = resolveHttpsRedirect(
      req('/queues', { 'x-forwarded-proto': 'http', host: 'dash.example.com:8443' })
    );
    expect(result).toEqual({
      kind: 'redirect',
      location: 'https://dash.example.com:8443/queues',
    });
  });

  it('does not carry the plain-HTTP port over to the https URL', () => {
    const result = resolveHttpsRedirect(
      req('/queues', { 'x-forwarded-proto': 'http', host: 'dash.example.com:80' })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dash.example.com/queues' });
  });

  it('uses Host and ignores a client-supplied X-Forwarded-Host', () => {
    // The 2026-10-12 review: this request used to get a 301 to https://evil.example/jobs.
    const result = resolveHttpsRedirect(
      req('/jobs', {
        'x-forwarded-proto': 'http',
        host: 'dashboard.spooled.cloud',
        'x-forwarded-host': 'evil.example',
      })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard.spooled.cloud/jobs' });
  });

  it('uses Host even when X-Forwarded-Host is a well-formed public name', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'dashboard.selfhosted.example',
        host: 'dashboard-internal:4321',
      })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard-internal:4321/jobs' });
  });

  it('falls back to X-Forwarded-Host (first entry) only when Host is missing', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'dashboard.spooled.cloud, proxy.internal',
      })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard.spooled.cloud/jobs' });
  });

  it('does not replace an invalid Host with X-Forwarded-Host', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', {
        'x-forwarded-proto': 'http',
        host: 'evil.example/x',
        'x-forwarded-host': 'dashboard.spooled.cloud',
      })
    );
    expect(result).toEqual({ kind: 'bad-host' });
  });

  describe('with trustForwardedHost (a proxy that rewrites Host to an internal name)', () => {
    const trust = { trustForwardedHost: true };

    it('prefers X-Forwarded-Host (the public host) over the rewritten Host', () => {
      const result = resolveHttpsRedirect(
        req('/jobs', {
          'x-forwarded-proto': 'http',
          'x-forwarded-host': 'dashboard.selfhosted.example',
          host: 'dashboard-internal:4321',
        }),
        trust
      );
      expect(result).toEqual({
        kind: 'redirect',
        location: 'https://dashboard.selfhosted.example/jobs',
      });
    });

    it('uses the first entry of a multi-proxy X-Forwarded-Host', () => {
      const result = resolveHttpsRedirect(
        req('/jobs', {
          'x-forwarded-proto': 'http',
          'x-forwarded-host': 'dashboard.spooled.cloud, proxy.internal',
          host: 'dashboard-internal',
        }),
        trust
      );
      expect(result).toEqual({
        kind: 'redirect',
        location: 'https://dashboard.spooled.cloud/jobs',
      });
    });

    it('uses Host when the proxy sent no X-Forwarded-Host', () => {
      const result = resolveHttpsRedirect(
        req('/jobs', { 'x-forwarded-proto': 'http', host: 'dashboard.spooled.cloud' }),
        trust
      );
      expect(result).toEqual({
        kind: 'redirect',
        location: 'https://dashboard.spooled.cloud/jobs',
      });
    });

    it('still refuses a malformed X-Forwarded-Host', () => {
      for (const forwarded of ['https://evil.example', 'evil.example/x', 'user@evil.example']) {
        expect(
          resolveHttpsRedirect(
            req('/jobs', {
              'x-forwarded-proto': 'http',
              'x-forwarded-host': forwarded,
              host: 'dashboard.spooled.cloud',
            }),
            trust
          )
        ).toEqual({ kind: 'bad-host' });
      }
    });
  });

  it('works for any self-hosted domain, nothing is hard-coded', () => {
    const result = resolveHttpsRedirect(
      req('/settings', { 'x-forwarded-proto': 'http', host: 'ops.acme.test' })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://ops.acme.test/settings' });
  });

  it('refuses a malicious Host header instead of redirecting to it', () => {
    for (const host of [
      'https://evil.example',
      'evil.example/steal',
      'user@evil.example',
      'evil.example evil2.example',
      'evil.example\\@dashboard.spooled.cloud',
    ]) {
      expect(resolveHttpsRedirect(req('/jobs', { 'x-forwarded-proto': 'http', host }))).toEqual({
        kind: 'bad-host',
      });
    }
  });

  it('ignores a malformed X-Forwarded-Host when Host is fine', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'evil.example/x',
        host: 'dashboard.spooled.cloud',
      })
    );
    expect(result).toEqual({ kind: 'redirect', location: 'https://dashboard.spooled.cloud/jobs' });
  });

  it('refuses a malformed X-Forwarded-Host when it is the only host', () => {
    const result = resolveHttpsRedirect(
      req('/jobs', { 'x-forwarded-proto': 'http', 'x-forwarded-host': 'evil.example/x' })
    );
    expect(result).toEqual({ kind: 'bad-host' });
  });

  it('refuses a request that names no host at all', () => {
    expect(resolveHttpsRedirect(req('/jobs', { 'x-forwarded-proto': 'http' }))).toEqual({
      kind: 'bad-host',
    });
  });

  it('keeps a path that looks like a host inside the path', () => {
    const result = resolveHttpsRedirect(
      req('//evil.example/phish', {
        'x-forwarded-proto': 'http',
        host: 'dashboard.spooled.cloud',
      })
    );
    expect(result).toEqual({
      kind: 'redirect',
      location: 'https://dashboard.spooled.cloud//evil.example/phish',
    });
  });

  it('leaves https requests untouched', () => {
    expect(
      resolveHttpsRedirect(
        req('/jobs', { 'x-forwarded-proto': 'https', host: 'dashboard.spooled.cloud' })
      )
    ).toEqual({ kind: 'none' });
  });

  it('leaves requests without a forwarded protocol untouched, even with a hostile Host', () => {
    expect(resolveHttpsRedirect(req('/jobs', { host: 'dashboard.spooled.cloud' }))).toEqual({
      kind: 'none',
    });
    expect(resolveHttpsRedirect(req('/jobs', { host: 'evil.example/x' }))).toEqual({
      kind: 'none',
    });
  });
});

describe('trustForwardedHostFromEnv', () => {
  it('is on only for TRUE / true', () => {
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: 'true' })).toBe(true);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: 'TRUE' })).toBe(true);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: ' true ' })).toBe(true);
  });

  it('is off by default and for anything else', () => {
    expect(trustForwardedHostFromEnv({})).toBe(false);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: '' })).toBe(false);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: 'false' })).toBe(false);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: '1' })).toBe(false);
    expect(trustForwardedHostFromEnv({ TRUST_FORWARDED_HOST: 'yes' })).toBe(false);
  });
});
