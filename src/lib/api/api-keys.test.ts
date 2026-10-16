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
      const { keys, newestOnly } = await apiKeysAPI.list();

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
      expect(newestOnly).toBe(false);
    });

    it('should return API keys with required fields', async () => {
      const { keys } = await apiKeysAPI.list();
      const key = keys[0];

      expect(key).toHaveProperty('id');
      expect(key).toHaveProperty('name');
      expect(key).toHaveProperty('queues');
      expect(key).toHaveProperty('is_active');
    });

    function keyRow(id: string, name = id) {
      return {
        id,
        name,
        queues: ['*'],
        rate_limit: null,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        last_used: null,
        expires_at: null,
      };
    }

    it('pages with limit and offset until X-Has-More is false', async () => {
      const all = Array.from({ length: 150 }, (_, i) =>
        keyRow(`key-${i}`, i === 149 ? 'Oldest live key' : `Key ${i}`)
      );
      const offsets: number[] = [];
      server.use(
        http.get(`${API_BASE}/api/v1/api-keys`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 0);
          offsets.push(offset);
          expect(limit).toBe(100);
          const slice = all.slice(offset, offset + limit);
          return HttpResponse.json(slice, {
            headers: { 'X-Has-More': String(offset + limit < all.length) },
          });
        })
      );

      const { keys, newestOnly } = await apiKeysAPI.list();
      expect(offsets).toEqual([0, 100]);
      expect(newestOnly).toBe(false);
      expect(keys).toHaveLength(150);
      expect(keys.some((key) => key.name === 'Oldest live key')).toBe(true);
    });

    it('pages when the server honors offset but does not send X-Has-More', async () => {
      const all = Array.from({ length: 120 }, (_, i) => keyRow(`key-${i}`));
      server.use(
        http.get(`${API_BASE}/api/v1/api-keys`, ({ request }) => {
          const url = new URL(request.url);
          const offset = Number(url.searchParams.get('offset') ?? 0);
          const limit = Number(url.searchParams.get('limit') ?? 0);
          return HttpResponse.json(all.slice(offset, offset + limit));
        })
      );

      const { keys, newestOnly } = await apiKeysAPI.list();
      expect(newestOnly).toBe(false);
      expect(keys).toHaveLength(120);
    });

    it('stops when an old server ignores limit and offset and repeats the first page', async () => {
      const page = Array.from({ length: 100 }, (_, i) => keyRow(`key-${i}`, `Revoked ${i}`));
      let calls = 0;
      server.use(
        http.get(`${API_BASE}/api/v1/api-keys`, () => {
          calls += 1;
          return HttpResponse.json(page);
        })
      );

      const { keys, newestOnly } = await apiKeysAPI.list();
      expect(newestOnly).toBe(true);
      expect(keys).toHaveLength(100);
      expect(new Set(keys.map((key) => key.id)).size).toBe(100);
      expect(calls).toBe(2);
    });

    it('does not mark a complete short page as only the newest 100', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/api-keys`, () => HttpResponse.json([keyRow('only-key')]))
      );

      const { keys, newestOnly } = await apiKeysAPI.list();
      expect(newestOnly).toBe(false);
      expect(keys).toHaveLength(1);
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
