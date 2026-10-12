/**
 * Astro middleware — security headers on the Node/Cloudflare response path.
 *
 * Static `_headers` only apply to Cloudflare Pages static hosting.
 * This middleware covers the Astro Node standalone server used in production.
 */
import { defineMiddleware } from 'astro:middleware';
import { resolveHttpsRedirect, trustForwardedHostFromEnv } from './lib/utils/https-redirect';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy-Report-Only': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss: http://localhost:* ws://localhost:* https://*.ingest.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
};

export const onRequest = defineMiddleware(async (context, next) => {
  // Plain HTTP behind the TLS-terminating proxy: send the client to the same host over HTTPS.
  // The target host comes from the Host header (X-Forwarded-Host only when TRUST_FORWARDED_HOST
  // is set or Host is missing), syntax-checked, not from `request.url`, whose host is always
  // `localhost` behind the tunnel.
  const redirect = resolveHttpsRedirect(context.request, {
    trustForwardedHost: trustForwardedHostFromEnv(),
  });
  if (redirect.kind === 'redirect') {
    return new Response(null, {
      status: 301,
      headers: { Location: redirect.location, 'Cache-Control': 'no-store' },
    });
  }
  if (redirect.kind === 'bad-host') {
    return new Response('Bad Request: invalid Host header', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const response = await next();

  // Clone headers so we can mutate even if the response is immutable
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  // HSTS only makes sense behind HTTPS (Cloudflare terminates TLS in production)
  if (!headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
