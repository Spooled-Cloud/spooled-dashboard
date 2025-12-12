/**
 * Runtime Configuration Loader
 *
 * Fetches configuration from the server at runtime, allowing environment
 * variables to be changed per deployment without rebuilding the image.
 */

import type { RuntimeConfig } from '@/pages/api/config';

// Default configuration (fallback if fetch fails)
const defaultConfig: RuntimeConfig = {
  apiUrl: 'https://api.spooled.cloud',
  wsUrl: 'wss://api.spooled.cloud',
  sentryEnvironment: 'production',
  enableWorkflows: true,
  enableSchedules: true,
  enableAnalytics: false,
};

// Cached configuration
let cachedConfig: RuntimeConfig | null = null;
let configPromise: Promise<RuntimeConfig> | null = null;

/**
 * Load runtime configuration from the server
 * Caches the result to avoid multiple fetches
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if already loading
  if (configPromise) {
    return configPromise;
  }

  // Start loading
  configPromise = fetchConfig();
  cachedConfig = await configPromise;
  return cachedConfig;
}

/**
 * Get cached config synchronously (returns default if not loaded yet)
 */
export function getRuntimeConfig(): RuntimeConfig {
  return cachedConfig || defaultConfig;
}

/**
 * Check if config has been loaded
 */
export function isConfigLoaded(): boolean {
  return cachedConfig !== null;
}

async function fetchConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      console.warn('Failed to fetch runtime config, using defaults');
      return defaultConfig;
    }
    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch runtime config, using defaults:', error);
    return defaultConfig;
  }
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
