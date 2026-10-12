/**
 * HTTP -> HTTPS redirect target for the Node server behind a TLS-terminating proxy.
 *
 * Astro's Node adapter builds `request.url` from the socket and does not trust forwarded host
 * headers unless `security.allowedDomains` is configured, so behind a tunnel or reverse proxy
 * the URL host is always `localhost`. A redirect built from that URL sent every plain-HTTP
 * visitor to `https://localhost/...`.
 *
 * The public host is therefore taken from the request headers. `Host` comes first: Cloudflare
 * Tunnel, Caddy and ingress-nginx pass it through unchanged. `X-Forwarded-Host` is used only when
 * `Host` is missing, or before `Host` when the operator opts in with `TRUST_FORWARDED_HOST=true`
 * (a proxy that rewrites `Host` to an internal name). The value is accepted only when it is a
 * bare `hostname[:port]`; anything else (a scheme, path, userinfo, whitespace, a comma, an
 * unparsable address, a non-decimal or out-of-range port) is refused. `Host` is a single value,
 * so a comma in it is never split: it answers `bad-host`. Only the forwarded headers, which proxies
 * append to, are read as lists (first entry). One trailing dot (an absolute name, `example.com.`)
 * is accepted and dropped from the redirect target.
 *
 * This is a syntax check, not an allowlist. The redirect points at the host the request itself
 * names: a client that sends `Host: other.example` gets a 301 to `https://other.example/`. It
 * only sends a client where that client said it was going, and the 301 is `no-store`. A browser
 * cannot be made to send a forged Host or X-Forwarded-Host for another user, but a proxy that
 * forwards a client-supplied `X-Forwarded-Host` should strip it (and no cache rule should
 * override `no-store` on this response).
 */

/**
 * One DNS label: 1-63 letters, digits or hyphens, not starting or ending with a hyphen.
 * Underscores are tolerated because container and internal names use them and browsers send them.
 */
const DNS_LABEL = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;
const MAX_HOSTNAME_LENGTH = 253;
const IPV6_LITERAL = /^(\[[0-9a-f:.]{2,45}\])(?::(\d{1,5}))?$/;
const HOST_WITH_PORT = /^([^:]+)(?::(\d{1,5}))?$/;

export type HttpsRedirect =
  /** The request is not plain HTTP behind the proxy: serve it as usual. */
  | { kind: 'none' }
  /** Answer with a 301 to `location`. */
  | { kind: 'redirect'; location: string }
  /** The request is plain HTTP but names no usable host: answer 400. */
  | { kind: 'bad-host' };

/**
 * Validate a `Host` / `X-Forwarded-Host` value and return it normalised for use in an
 * `https://` URL (lower case, one trailing dot and default ports dropped), or `null` when it is
 * not exactly a hostname or IP literal with an optional decimal port in 1-65535.
 */
export function parsePublicHost(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  // Longest legal value is a 253-character name, its trailing dot and ":65535".
  if (value.length === 0 || value.length > MAX_HOSTNAME_LENGTH + 7) return null;

  let hostname: string;
  let port: string | undefined;

  const ipv6 = IPV6_LITERAL.exec(value);
  if (ipv6) {
    hostname = ipv6[1];
    port = ipv6[2];
  } else {
    const named = HOST_WITH_PORT.exec(value);
    if (!named) return null;
    hostname = named[1];
    port = named[2];
    // `example.com.` is the absolute form of `example.com`. Drop exactly one trailing dot; a
    // second one (or a lone dot) leaves an empty label below and is refused.
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
    if (hostname.length > MAX_HOSTNAME_LENGTH) return null;
    if (!hostname.split('.').every((label) => DNS_LABEL.test(label))) return null;
  }

  // The patterns above only let 1-5 ASCII digits through, so `Number` reads them as plain decimal
  // (`0x50`, `+80`, `8e1` and full-width digits never get here). Compare the number, not the text:
  // `0080` is port 80.
  let portNumber: number | undefined;
  if (port !== undefined) {
    portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return null;
  }

  // Let the URL parser have the last word: it must read the value back as the same bare host
  // (this rejects `999.1.1.1`, `0x7f.1` and malformed IPv6, which it would otherwise rewrite).
  let parsed: URL;
  try {
    parsed = new URL(`https://${hostname}`);
  } catch {
    return null;
  }
  if (
    parsed.hostname !== hostname ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return null;
  }

  // The client reached us over plain HTTP; port 80 has no HTTPS meaning, so use 443.
  // Other ports are kept as asked for (an https listener on the same port is the operator's call).
  if (portNumber === undefined || portNumber === 80 || portNumber === 443) return hostname;
  return `${hostname}:${portNumber}`;
}

/** First entry of a possibly comma-separated forwarded header (the original client-facing value). */
function firstHeaderValue(value: string | null): string | null {
  if (value === null) return null;
  const first = value.split(',')[0].trim();
  return first === '' ? null : first;
}

/**
 * The `Host` header as sent. It holds one authority and is never a list, so it is not split on
 * commas: `a.example,b.example` stays whole and fails host validation. Blank counts as missing.
 */
function singleHeaderValue(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** True when the proxy reports that the client connected over plain HTTP. */
export function isPlainHttpRequest(headers: Headers): boolean {
  return firstHeaderValue(headers.get('x-forwarded-proto'))?.toLowerCase() === 'http';
}

export interface HttpsRedirectOptions {
  /**
   * Take the host from `X-Forwarded-Host` before `Host`. Off by default: only a proxy that
   * rewrites `Host` to an internal name needs it, and only then is the header trustworthy.
   */
  trustForwardedHost?: boolean;
}

/** True when `TRUST_FORWARDED_HOST` is `true` (any case) in `env`. Read on every request. */
export function trustForwardedHostFromEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.TRUST_FORWARDED_HOST?.trim().toLowerCase() === 'true';
}

/**
 * Decide what to do with a request that may have arrived over plain HTTP.
 *
 * Only requests the proxy marked `X-Forwarded-Proto: http` are touched; HTTPS requests and
 * direct requests without the header are served as before.
 *
 * The host is `Host`; `X-Forwarded-Host` is the fallback when `Host` is absent, and takes
 * priority only with `options.trustForwardedHost`. A present but invalid value is never
 * replaced by the other header: it answers `bad-host`.
 */
export function resolveHttpsRedirect(
  request: Request,
  options: HttpsRedirectOptions = {}
): HttpsRedirect {
  if (!isPlainHttpRequest(request.headers)) return { kind: 'none' };

  const host = singleHeaderValue(request.headers.get('host'));
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const requested = options.trustForwardedHost ? (forwardedHost ?? host) : (host ?? forwardedHost);
  const publicHost = parsePublicHost(requested);
  if (publicHost === null) return { kind: 'bad-host' };

  let path: string;
  try {
    const url = new URL(request.url);
    path = `${url.pathname}${url.search}`;
  } catch {
    path = '/';
  }
  // The authority is already complete, so a path such as `//evil.example/` stays a path.
  return { kind: 'redirect', location: `https://${publicHost}${path}` };
}
