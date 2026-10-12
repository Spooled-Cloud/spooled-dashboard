/**
 * HTTP -> HTTPS redirect target for the Node server behind a TLS-terminating proxy.
 *
 * Astro's Node adapter builds `request.url` from the socket and does not trust forwarded host
 * headers unless `security.allowedDomains` is configured, so behind a tunnel or reverse proxy
 * the URL host is always `localhost`. A redirect built from that URL sent every plain-HTTP
 * visitor to `https://localhost/...`.
 *
 * The public host is therefore taken from the request headers (`X-Forwarded-Host`, else
 * `Host`) and accepted only when it is a bare `hostname[:port]`. Anything else (a scheme, path,
 * userinfo, whitespace, a list, an unparsable address) is refused, so the redirect can only
 * ever point back at the host the client itself asked for and never at an arbitrary one.
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
 * `https://` URL (lower case, default ports dropped), or `null` when it is not exactly a
 * hostname or IP literal with an optional port.
 */
export function parsePublicHost(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  // Longest legal value is a 253-character name plus ":65535".
  if (value.length === 0 || value.length > MAX_HOSTNAME_LENGTH + 6) return null;

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
    if (hostname.length > MAX_HOSTNAME_LENGTH) return null;
    if (!hostname.split('.').every((label) => DNS_LABEL.test(label))) return null;
  }

  if (port !== undefined) {
    const portNumber = Number(port);
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
  if (port === undefined || port === '80' || port === '443') return hostname;
  return `${hostname}:${Number(port)}`;
}

/** First entry of a possibly comma-separated forwarded header (the original client-facing value). */
function firstHeaderValue(value: string | null): string | null {
  if (value === null) return null;
  const first = value.split(',')[0].trim();
  return first === '' ? null : first;
}

/** True when the proxy reports that the client connected over plain HTTP. */
export function isPlainHttpRequest(headers: Headers): boolean {
  return firstHeaderValue(headers.get('x-forwarded-proto'))?.toLowerCase() === 'http';
}

/**
 * Decide what to do with a request that may have arrived over plain HTTP.
 *
 * Only requests the proxy marked `X-Forwarded-Proto: http` are touched; HTTPS requests and
 * direct requests without the header are served as before.
 */
export function resolveHttpsRedirect(request: Request): HttpsRedirect {
  if (!isPlainHttpRequest(request.headers)) return { kind: 'none' };

  const requested =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ??
    firstHeaderValue(request.headers.get('host'));
  const host = parsePublicHost(requested);
  if (host === null) return { kind: 'bad-host' };

  let path: string;
  try {
    const url = new URL(request.url);
    path = `${url.pathname}${url.search}`;
  } catch {
    path = '/';
  }
  // The authority is already complete, so a path such as `//evil.example/` stays a path.
  return { kind: 'redirect', location: `https://${host}${path}` };
}
