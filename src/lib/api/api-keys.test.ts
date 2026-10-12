/**
 * Tests for API Keys API Module
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { apiKeysAPI } from './api-keys';
import { APIError } from './client';

const API_BASE = 'https://api.spooled.cloud';

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
      expect(key).toHaveProperty('queues');
      expect(key).toHaveProperty('is_active');
    });
  });

  describe('create', () => {
    it('should create a new API key', async () => {
      const response = await apiKeysAPI.create({
        name: 'Test Key',
        queues: ['*'],
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('key');
      expect(response.name).toBe('Test Key');
    });
  });

  describe('update', () => {
    it('renames a key and keeps everything else', async () => {
      const key = await apiKeysAPI.update('key-1', { name: 'Renamed' });
      expect(key.name).toBe('Renamed');
      expect(key.is_active).toBe(true);
      expect(key.queues).toEqual(['default', 'printer']);
    });

    it('sends only the fields it is given', async () => {
      let body: Record<string, unknown> | undefined;
      server.use(
        http.put(`${API_BASE}/api/v1/api-keys/:id`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({});
        })
      );
      await apiKeysAPI.update('key-1', { is_active: false });
      expect(body).toEqual({ is_active: false });
    });

    it('rejects with the plan cap error when a revoked key cannot be re-activated', async () => {
      server.use(
        http.put(`${API_BASE}/api/v1/api-keys/:id`, () =>
          HttpResponse.json(
            {
              error: 'limit_exceeded',
              code: 'QUOTA_EXCEEDED',
              message: 'api_keys limit reached',
              resource: 'api_keys',
              current: 2,
              limit: 2,
              plan: 'free',
            },
            { status: 429 }
          )
        )
      );
      const error = await apiKeysAPI.update('key-9', { is_active: true }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).isQuotaExceeded()).toBe(true);
      expect((error as APIError).details).toMatchObject({
        resource: 'api_keys',
        current: 2,
        limit: 2,
      });
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      // Should not throw
      await expect(apiKeysAPI.revoke('api-key-1')).resolves.not.toThrow();
    });
  });
});
