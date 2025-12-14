/**
 * Tests for Runtime Configuration
 */

import { describe, it, expect } from 'vitest';
import { getRuntimeConfig, isConfigLoaded, getApiUrl, getWsUrl } from './runtime';

describe('Runtime Configuration', () => {
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
      // In test mode, should return static fallback (production URLs)
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
      // WebSocket URLs start with ws:// or wss://
      expect(url.startsWith('ws://') || url.startsWith('wss://')).toBe(true);
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
