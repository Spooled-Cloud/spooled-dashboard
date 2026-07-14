/**
 * Runtime Configuration Loader
 *
 * Fetches configuration from the server at runtime, allowing environment
 * variables to be changed per deployment without rebuilding the image.
 * Call loadRuntimeConfig() before authenticated API, WebSocket, or Sentry use.
 */

import type { RuntimeConfig } from '@/pages/api/config';

export type { RuntimeConfig };

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigError';
  }
}

// Static fallback configuration (used on server or before window is available)
const staticFallback: RuntimeConfig = {
  apiUrl: 'https://api.spooled.cloud',
  wsUrl: 'wss://api.spooled.cloud',
  sentryEnvironment: 'production',
  enableWorkflows: true,
  enableSchedules: true,
  enableAnalytics: false,
  enableQueuePurge: false,
  version: '0.0.0-dev',
  commit: 'unknown',
  environment: 'test',
};

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isSecureProductionOrigin(hostname: string): boolean {
  return hostname === 'dashboard.spooled.cloud' || hostname.endsWith('.spooled.cloud');
}

/**
 * Validate and normalize a runtime config object.
 * Rejects secrets-looking keys and invalid URL schemes.
 */
export function validateRuntimeConfig(raw: unknown): RuntimeConfig {
  if (!raw || typeof raw !== 'object') {
    throw new RuntimeConfigError('Runtime config must be an object');
  }

  const input = raw as Record<string, unknown>;

  // Never accept credentials from config payloads
  for (const key of Object.keys(input)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('secret') ||
      lower.includes('password') ||
      lower.includes('api_key') ||
      lower.includes('apikey') ||
      lower.includes('admin') ||
      lower.includes('token')
    ) {
      if (lower !== 'sentrydsn' && lower !== 'sentry_dsn' && key !== 'sentryDsn') {
        throw new RuntimeConfigError(`Runtime config must not include secret field: ${key}`);
      }
    }
  }

  const apiUrl = String(input.apiUrl ?? '');
  const wsUrl = String(input.wsUrl ?? '');

  let api: URL;
  let ws: URL;
  try {
    api = new URL(apiUrl);
    ws = new URL(wsUrl);
  } catch {
    throw new RuntimeConfigError('Runtime config apiUrl/wsUrl must be absolute URLs');
  }

  if (api.protocol !== 'https:' && api.protocol !== 'http:') {
    throw new RuntimeConfigError('apiUrl must use http or https');
  }
  if (ws.protocol !== 'wss:' && ws.protocol !== 'ws:') {
    throw new RuntimeConfigError('wsUrl must use ws or wss');
  }

  // Production dashboard origin requires TLS to the API
  if (typeof window !== 'undefined' && isSecureProductionOrigin(window.location.hostname)) {
    if (api.protocol !== 'https:') {
      throw new RuntimeConfigError('Production apiUrl must use https');
    }
    if (ws.protocol !== 'wss:') {
      throw new RuntimeConfigError('Production wsUrl must use wss');
    }
  }

  if (api.host !== ws.host) {
    // Allow intentional splits but warn via throw only for empty hosts
    if (!api.host || !ws.host) {
      throw new RuntimeConfigError('apiUrl and wsUrl must include a host');
    }
  }

  return {
    apiUrl: api.origin,
    wsUrl: ws.origin,
    sentryDsn: typeof input.sentryDsn === 'string' ? input.sentryDsn : undefined,
    sentryEnvironment:
      typeof input.sentryEnvironment === 'string' ? input.sentryEnvironment : 'production',
    sentryRelease: typeof input.sentryRelease === 'string' ? input.sentryRelease : undefined,
    enableWorkflows: input.enableWorkflows !== false,
    enableSchedules: input.enableSchedules !== false,
    enableAnalytics: input.enableAnalytics === true,
    enableQueuePurge: input.enableQueuePurge === true,
    version: typeof input.version === 'string' ? input.version : undefined,
    commit: typeof input.commit === 'string' ? input.commit : undefined,
    environment: typeof input.environment === 'string' ? input.environment : undefined,
  };
}

// Get default config with localhost detection
function getDefaultConfig(): RuntimeConfig {
  // In test runs (vitest), we want deterministic config and MSW handlers to match.
  if (import.meta.env.MODE === 'test') {
    return staticFallback;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (isLocalHostname(hostname)) {
      return {
        ...staticFallback,
        apiUrl: 'http://localhost:8080',
        wsUrl: 'ws://localhost:8080',
        environment: 'development',
      };
    }
  }
  return staticFallback;
}

// Cached configuration
let cachedConfig: RuntimeConfig | null = null;
let configPromise: Promise<RuntimeConfig> | null = null;
let loadError: Error | null = null;

/**
 * Reset cache (tests / HMR only)
 */
export function resetRuntimeConfigCache(): void {
  cachedConfig = null;
  configPromise = null;
  loadError = null;
}

/**
 * Load runtime configuration from the server.
 * Caches the result; concurrent callers share one fetch.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (configPromise) {
    return configPromise;
  }

  configPromise = fetchConfig()
    .then((config) => {
      cachedConfig = config;
      loadError = null;
      return config;
    })
    .catch((error: unknown) => {
      configPromise = null;
      loadError = error instanceof Error ? error : new RuntimeConfigError(String(error));
      // Soft-fail to defaults so local/offline still boots with intentional fallback
      cachedConfig = getDefaultConfig();
      return cachedConfig;
    });

  return configPromise;
}

/**
 * Get cached config synchronously (returns default if not loaded yet)
 */
export function getRuntimeConfig(): RuntimeConfig {
  return cachedConfig || getDefaultConfig();
}

/**
 * Check if config has been loaded from network or soft-fallback completed
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}

/**
 * Last load error if soft-fallback was used after a failed fetch/validation
 */
export function getRuntimeConfigError(): Error | null {
  return loadError;
}

async function fetchConfig(): Promise<RuntimeConfig> {
  // SSR / non-browser: use defaults
  if (typeof window === 'undefined') {
    return getDefaultConfig();
  }

  const response = await fetch('/api/config', {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new RuntimeConfigError(`Failed to fetch runtime config: HTTP ${response.status}`);
  }

  const json: unknown = await response.json();
  return validateRuntimeConfig(json);
}

/**
 * Get API base URL
 */
export function getApiUrl(): string {
  return getRuntimeConfig().apiUrl;
}

/**
 * Get WebSocket base URL
 */
export function getWsUrl(): string {
  return getRuntimeConfig().wsUrl;
}
