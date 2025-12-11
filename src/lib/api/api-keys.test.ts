/**
 * Tests for API Keys API Module
 */

import { describe, it, expect } from 'vitest';
import { apiKeysAPI } from './api-keys';

describe('apiKeysAPI', () => {
  describe('list', () => {
    it('should list all API keys', async () => {
      const keys = await apiKeysAPI.list();

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should return API keys with required fields', async () => {
      const keys = await apiKeysAPI.list();
      const key = keys[0];

      expect(key).toHaveProperty('id');
      expect(key).toHaveProperty('name');
      expect(key).toHaveProperty('key_prefix');
      expect(key).toHaveProperty('permissions');
    });
  });

  describe('create', () => {
    it('should create a new API key', async () => {
      const response = await apiKeysAPI.create({
        name: 'Test Key',
        permissions: ['jobs:read', 'jobs:write'],
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('key');
      expect(response.name).toBe('Test Key');
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      // Should not throw
      await expect(apiKeysAPI.revoke('api-key-1')).resolves.not.toThrow();
    });
  });
});
