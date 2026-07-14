/**
 * Astro middleware — security headers on the Node/Cloudflare response path.
 *
 * Static `_headers` only apply to Cloudflare Pages static hosting.
 * This middleware covers the Astro Node standalone server used in production.
 */
import { defineMiddleware } from 'astro:middleware';

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
  const forwardedProto = context.request.headers.get('x-forwarded-proto');
  if (forwardedProto === 'http') {
    const url = new URL(context.request.url);
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
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
