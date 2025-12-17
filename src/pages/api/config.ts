/**
 * Runtime Configuration Endpoint
 *
 * This endpoint exposes runtime environment variables to the client.
 * Unlike build-time PUBLIC_* variables, these can be changed per deployment.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export interface RuntimeConfig {
  apiUrl: string;
  wsUrl: string;
  sentryDsn?: string;
  sentryEnvironment?: string;
  enableWorkflows?: boolean;
  enableSchedules?: boolean;
  enableAnalytics?: boolean;
  enableQueuePurge?: boolean;
}

export const GET: APIRoute = () => {
  const config: RuntimeConfig = {
    apiUrl: process.env.PUBLIC_API_URL || 'https://api.spooled.cloud',
    wsUrl: process.env.PUBLIC_WS_URL || 'wss://api.spooled.cloud',
    sentryDsn: process.env.PUBLIC_SENTRY_DSN,
    sentryEnvironment: process.env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
    enableWorkflows: process.env.PUBLIC_ENABLE_WORKFLOWS !== 'false',
    enableSchedules: process.env.PUBLIC_ENABLE_SCHEDULES !== 'false',
    enableAnalytics: process.env.PUBLIC_ENABLE_ANALYTICS === 'true',
    // Queue purge disabled by default - not implemented in backend
    enableQueuePurge: process.env.PUBLIC_ENABLE_QUEUE_PURGE === 'true',
  };

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Browser cache: 5 minutes, CDN/edge cache: 1 hour
      // s-maxage controls shared caches (CDN), max-age controls browser
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      // Cloudflare-specific: cache at edge for 1 hour
      'CDN-Cache-Control': 'public, max-age=3600',
    },
  });
};
