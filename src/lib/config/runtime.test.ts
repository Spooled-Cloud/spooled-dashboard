/**
 * Tests for Runtime Configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRuntimeConfig,
  isConfigLoaded,
  getApiUrl,
  getWsUrl,
  validateRuntimeConfig,
  loadRuntimeConfig,
  resetRuntimeConfigCache,
  RuntimeConfigError,
  shouldAllowRuntimeConfigFallback,
} from './runtime';

const validConfig = {
  apiUrl: 'https://api.spooled.cloud',
  wsUrl: 'wss://api.spooled.cloud',
  sentryEnvironment: 'test',
  enableWorkflows: true,
  enableSchedules: true,
  enableAnalytics: false,
  version: '0.1.60',
  commit: 'abc123def',
  environment: 'test',
};

describe('Runtime Configuration', () => {
  beforeEach(() => {
    resetRuntimeConfigCache();
    vi.restoreAllMocks();
  });

  describe('getRuntimeConfig', () => {
    it('should return default config in test environment', () => {
      const config = getRuntimeConfig();
      expect(config).toBeDefined();
      expect(config.apiUrl).toBeDefined();
      expect(config.wsUrl).toBeDefined();
    });

    it('should have all required properties', () => {
      const config = getRuntimeConfig();
      expect(config).toHaveProperty('apiUrl');
      expect(config).toHaveProperty('wsUrl');
      expect(config).toHaveProperty('sentryEnvironment');
      expect(config).toHaveProperty('enableWorkflows');
      expect(config).toHaveProperty('enableSchedules');
      expect(config).toHaveProperty('enableAnalytics');
    });

    it('should return production URLs in test mode', () => {
      const config = getRuntimeConfig();
      expect(config.apiUrl).toBe('https://api.spooled.cloud');
      expect(config.wsUrl).toBe('wss://api.spooled.cloud');
    });

    it('should have correct feature flags', () => {
      const config = getRuntimeConfig();
      expect(typeof config.enableWorkflows).toBe('boolean');
      expect(typeof config.enableSchedules).toBe('boolean');
      expect(typeof config.enableAnalytics).toBe('boolean');
    });
  });

  describe('isConfigLoaded', () => {
    it('should return a boolean', () => {
      const loaded = isConfigLoaded();
      expect(typeof loaded).toBe('boolean');
    });
  });

  describe('getApiUrl', () => {
    it('should return API URL string', () => {
      const url = getApiUrl();
      expect(typeof url).toBe('string');
      expect(url.startsWith('http')).toBe(true);
    });

    it('should return valid URL', () => {
      const url = getApiUrl();
      expect(() => new URL(url)).not.toThrow();
    });
  });

  describe('getWsUrl', () => {
    it('should return WebSocket URL string', () => {
      const url = getWsUrl();
      expect(typeof url).toBe('string');
      expect(url.startsWith('ws')).toBe(true);
    });

    it('should return valid WebSocket URL', () => {
      const url = getWsUrl();
      expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(true);
    });
  });

  describe('validateRuntimeConfig', () => {
    it('should accept valid https/wss config', () => {
      const config = validateRuntimeConfig(validConfig);

      expect(config.apiUrl).toBe('https://api.spooled.cloud');
      expect(config.wsUrl).toBe('wss://api.spooled.cloud');
      expect(config.version).toBe('0.1.60');
      expect(config.commit).toBe('abc123def');
    });

    it('should accept valid http/ws config for local dev', () => {
      const config = validateRuntimeConfig({
        apiUrl: 'http://localhost:8080',
        wsUrl: 'ws://localhost:8080',
      });

      expect(config.apiUrl).toBe('http://localhost:8080');
      expect(config.wsUrl).toBe('ws://localhost:8080');
    });

    it('should reject non-object input', () => {
      expect(() => validateRuntimeConfig(null)).toThrow(RuntimeConfigError);
      expect(() => validateRuntimeConfig('bad')).toThrow(RuntimeConfigError);
    });

    it('should reject secret-looking fields', () => {
      expect(() =>
        validateRuntimeConfig({
          ...validConfig,
          adminApiKey: 'secret',
        })
      ).toThrow(/secret field/i);

      expect(() =>
        validateRuntimeConfig({
          ...validConfig,
          api_key: 'secret',
        })
      ).toThrow(/secret field/i);

      expect(() =>
        validateRuntimeConfig({
          ...validConfig,
          accessToken: 'secret',
        })
      ).toThrow(/secret field/i);
    });

    it('should reject invalid URL schemes', () => {
      expect(() =>
        validateRuntimeConfig({
          apiUrl: 'ftp://api.example.com',
          wsUrl: 'wss://api.example.com',
        })
      ).toThrow(/apiUrl must use http or https/i);

      expect(() =>
        validateRuntimeConfig({
          apiUrl: 'https://api.example.com',
          wsUrl: 'http://api.example.com',
        })
      ).toThrow(/wsUrl must use ws or wss/i);
    });

    it('should reject malformed URLs', () => {
      expect(() =>
        validateRuntimeConfig({
          apiUrl: 'not-a-url',
          wsUrl: 'wss://api.example.com',
        })
      ).toThrow(/absolute URLs/i);
    });
  });

  describe('loadRuntimeConfig', () => {
    it('should fetch and cache validated config', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => validConfig,
      });
      vi.stubGlobal('fetch', fetchMock);

      const config = await loadRuntimeConfig();

      expect(fetchMock).toHaveBeenCalledWith('/api/config', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      expect(config.apiUrl).toBe('https://api.spooled.cloud');
      expect(config.wsUrl).toBe('wss://api.spooled.cloud');
      expect(isConfigLoaded()).toBe(true);

      vi.unstubAllGlobals();
    });

    it('should only allow config fetch fallback on local hostnames', () => {
      expect(shouldAllowRuntimeConfigFallback('localhost')).toBe(true);
      expect(shouldAllowRuntimeConfigFallback('127.0.0.1')).toBe(true);
      expect(shouldAllowRuntimeConfigFallback('dashboard.spooled.cloud')).toBe(false);
      expect(shouldAllowRuntimeConfigFallback('staging.spooled.cloud')).toBe(false);
    });
  });
});

describe('RuntimeConfig interface', () => {
  it('should have correct structure', () => {
    const config = {
      apiUrl: 'https://api.example.com',
      wsUrl: 'wss://api.example.com',
      sentryEnvironment: 'production',
      enableWorkflows: true,
      enableSchedules: true,
      enableAnalytics: false,
    };

    expect(config.apiUrl).toBe('https://api.example.com');
    expect(config.wsUrl).toBe('wss://api.example.com');
    expect(config.sentryEnvironment).toBe('production');
    expect(config.enableWorkflows).toBe(true);
    expect(config.enableSchedules).toBe(true);
    expect(config.enableAnalytics).toBe(false);
  });

  it('should support different environments', () => {
    const devConfig = {
      apiUrl: 'http://localhost:8080',
      wsUrl: 'ws://localhost:8080',
      sentryEnvironment: 'development',
      enableWorkflows: true,
      enableSchedules: true,
      enableAnalytics: false,
    };

    expect(devConfig.apiUrl).toContain('localhost');
    expect(devConfig.sentryEnvironment).toBe('development');
  });
});

describe('URL consistency', () => {
  it('should have matching protocols', () => {
    const config = getRuntimeConfig();
    const apiUrl = new URL(config.apiUrl);

    if (apiUrl.protocol === 'https:') {
      expect(config.wsUrl.startsWith('wss://')).toBe(true);
    } else if (apiUrl.protocol === 'http:') {
      expect(config.wsUrl.startsWith('ws://')).toBe(true);
    }
  });

  it('should have matching hosts', () => {
    const config = getRuntimeConfig();
    const apiUrl = new URL(config.apiUrl);
    const wsUrl = new URL(config.wsUrl);

    expect(apiUrl.host).toBe(wsUrl.host);
  });
});
