/**
 * Runtime Configuration Endpoint
 *
 * Exposes safe, non-secret runtime values to the browser.
 * API/WS URLs and feature flags are consumed after client bootstrap.
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const prerender = false;

export interface RuntimeConfig {
  apiUrl: string;
  wsUrl: string;
  sentryDsn?: string;
  sentryEnvironment?: string;
  sentryRelease?: string;
  enableWorkflows?: boolean;
  enableSchedules?: boolean;
  enableAnalytics?: boolean;
  enableQueuePurge?: boolean;
  /** Package / image version (e.g. 0.1.60) */
  version?: string;
  /** Source commit SHA injected at image build time */
  commit?: string;
  /** Environment label (non-secret) */
  environment?: string;
}

function resolvePackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // dist/server/pages/api → repo root package.json in container is /app/package.json
    const candidates = [
      join(process.cwd(), 'package.json'),
      join(here, '../../../../package.json'),
      join(here, '../../../../../package.json'),
    ];
    for (const path of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
        if (pkg.version) return pkg.version;
      } catch {
        // try next
      }
    }
  } catch {
    // fall through
  }
  return process.env.APP_VERSION || '0.0.0-dev';
}

function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Report-only CSP: allow self, API/WS origins are browser-enforced separately for fetch/WS
  headers.set(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss: http://localhost:* ws://localhost:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')
  );
}

export const GET: APIRoute = () => {
  const version = process.env.APP_VERSION || resolvePackageVersion();
  const commit = process.env.SOURCE_COMMIT || process.env.GIT_COMMIT || 'unknown';
  const environment = process.env.PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production';

  const config: RuntimeConfig = {
    apiUrl: process.env.PUBLIC_API_URL || 'https://api.spooled.cloud',
    wsUrl: process.env.PUBLIC_WS_URL || 'wss://api.spooled.cloud',
    sentryDsn: process.env.PUBLIC_SENTRY_DSN || undefined,
    sentryEnvironment: environment,
    sentryRelease: process.env.PUBLIC_SENTRY_RELEASE || `${version}+${commit.slice(0, 12)}`,
    enableWorkflows: process.env.PUBLIC_ENABLE_WORKFLOWS !== 'false',
    enableSchedules: process.env.PUBLIC_ENABLE_SCHEDULES !== 'false',
    enableAnalytics: process.env.PUBLIC_ENABLE_ANALYTICS === 'true',
    // Queue purge disabled by default - not implemented in backend
    enableQueuePurge: process.env.PUBLIC_ENABLE_QUEUE_PURGE === 'true',
    version,
    commit,
    environment,
  };

  const headers = new Headers({
    'Content-Type': 'application/json',
    // Short browser cache only — deployment config must not stick for hours behind CDN
    'Cache-Control': 'private, max-age=60, must-revalidate',
  });
  applySecurityHeaders(headers);

  return new Response(JSON.stringify(config), {
    status: 200,
    headers,
  });
};
