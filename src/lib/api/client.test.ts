/**
 * Tests for API Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, APIError, NetworkError } from './client';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
// HTTP_STATUS constants are tested via response behavior

const API_BASE = 'https://api.spooled.cloud';

describe('APIError', () => {
  describe('constructor', () => {
    it('should create APIError with all properties', () => {
      const error = new APIError(400, 'VALIDATION_ERROR', 'Invalid input', { field: 'name' });
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'name' });
      expect(error.name).toBe('APIError');
    });

    it('should create APIError without details', () => {
      const error = new APIError(404, 'NOT_FOUND', 'Not found');
      expect(error.details).toBeUndefined();
    });
  });

  describe('fromResponse', () => {
    it('should create APIError from JSON response', async () => {
      const response = new Response(
        JSON.stringify({ code: 'CUSTOM_ERROR', message: 'Custom message', details: { id: 1 } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      const error = await APIError.fromResponse(response);
      expect(error.status).toBe(400);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('Custom message');
      expect(error.details).toEqual({ id: 1 });
    });

    it('should create APIError from non-JSON response', async () => {
      const response = new Response('Internal Server Error', { status: 500 });
      const error = await APIError.fromResponse(response);
      expect(error.status).toBe(500);
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.message).toBe('HTTP Error: 500');
    });

    it('should handle empty response body', async () => {
      const response = new Response(null, { status: 401 });
      const error = await APIError.fromResponse(response);
      expect(error.status).toBe(401);
      expect(error.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('status check methods', () => {
    it('isUnauthorized returns true for 401', () => {
      const error = new APIError(401, 'UNAUTHORIZED', 'Unauthorized');
      expect(error.isUnauthorized()).toBe(true);
      expect(error.isForbidden()).toBe(false);
    });

    it('isForbidden returns true for 403', () => {
      const error = new APIError(403, 'FORBIDDEN', 'Forbidden');
      expect(error.isForbidden()).toBe(true);
      expect(error.isUnauthorized()).toBe(false);
    });

    it('isNotFound returns true for 404', () => {
      const error = new APIError(404, 'NOT_FOUND', 'Not found');
      expect(error.isNotFound()).toBe(true);
    });

    it('isValidationError returns true for 422', () => {
      const error = new APIError(422, 'VALIDATION', 'Validation error');
      expect(error.isValidationError()).toBe(true);
    });

    it('isRateLimited returns true for 429', () => {
      const error = new APIError(429, 'RATE_LIMITED', 'Too many requests');
      expect(error.isRateLimited()).toBe(true);
    });

    it('isServerError returns true for 500+', () => {
      expect(new APIError(500, 'ERROR', 'Error').isServerError()).toBe(true);
      expect(new APIError(502, 'ERROR', 'Error').isServerError()).toBe(true);
      expect(new APIError(503, 'ERROR', 'Error').isServerError()).toBe(true);
      expect(new APIError(499, 'ERROR', 'Error').isServerError()).toBe(false);
    });
  });
});

describe('NetworkError', () => {
  it('should create with default message', () => {
    const error = new NetworkError();
    expect(error.message).toBe('Network request failed');
    expect(error.name).toBe('NetworkError');
  });

  it('should create with custom message', () => {
    const error = new NetworkError('Connection timeout');
    expect(error.message).toBe('Connection timeout');
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    // Reset any request mocks
    server.resetHandlers();
  });

  describe('configuration', () => {
    it('should set token getter and include Authorization header', async () => {
      apiClient.setTokenGetter(() => 'test-token-123');

      let capturedAuth: string | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/auth-test`, ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        })
      );

      await apiClient.get('/api/v1/auth-test');
      expect(capturedAuth).toBe('Bearer test-token-123');

      // Clean up
      apiClient.setTokenGetter(() => null);
    });

    it('should set org ID getter and include X-Organization-ID header', async () => {
      apiClient.setOrgIdGetter(() => 'org-456');

      let capturedOrgId: string | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/org-test`, ({ request }) => {
          capturedOrgId = request.headers.get('X-Organization-ID');
          return HttpResponse.json({ ok: true });
        })
      );

      await apiClient.get('/api/v1/org-test');
      expect(capturedOrgId).toBe('org-456');

      // Clean up
      apiClient.setOrgIdGetter(() => null);
    });

    it('should skip auth header when skipAuth is true', async () => {
      apiClient.setTokenGetter(() => 'token');

      let capturedAuth: string | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/skip-auth`, ({ request }) => {
          capturedAuth = request.headers.get('Authorization');
          return HttpResponse.json({ ok: true });
        })
      );

      await apiClient.get('/api/v1/skip-auth', undefined, { skipAuth: true });
      expect(capturedAuth).toBeNull();

      apiClient.setTokenGetter(() => null);
    });
  });

  describe('query parameters', () => {
    it('should include query params in URL', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${API_BASE}/api/v1/search`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ results: [] });
        })
      );

      await apiClient.get('/api/v1/search', { q: 'test', page: 1, active: true });
      expect(capturedUrl).toContain('q=test');
      expect(capturedUrl).toContain('page=1');
      expect(capturedUrl).toContain('active=true');
    });

    it('should skip undefined query params', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${API_BASE}/api/v1/filter`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ results: [] });
        })
      );

      await apiClient.get('/api/v1/filter', { status: 'active', type: undefined });
      expect(capturedUrl).toContain('status=active');
      expect(capturedUrl).not.toContain('type');
    });
  });

  describe('GET requests', () => {
    it('should make successful GET requests', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/test`, () => {
          return HttpResponse.json({ success: true, data: 'test' });
        })
      );

      const result = await apiClient.get('/api/v1/test');
      expect(result).toEqual({ success: true, data: 'test' });
    });

    it('should handle 404 errors', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/not-found`, () => {
          return HttpResponse.json(
            { code: 'NOT_FOUND', message: 'Resource not found' },
            { status: 404 }
          );
        })
      );

      await expect(apiClient.get('/api/v1/not-found')).rejects.toThrow(APIError);
    });

    it('should handle 500 errors', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/error`, () => {
          return HttpResponse.json(
            { code: 'INTERNAL_ERROR', message: 'Server error' },
            { status: 500 }
          );
        })
      );

      await expect(apiClient.get('/api/v1/error')).rejects.toThrow(APIError);
    });
  });

  describe('POST requests', () => {
    it('should make successful POST requests with body', async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/create`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ ...(body as object), id: '123' }, { status: 201 });
        })
      );

      const result = await apiClient.post('/api/v1/create', { name: 'test' });
      expect(result).toEqual({ name: 'test', id: '123' });
    });

    it('should make POST request without body', async () => {
      server.use(
        http.post(`${API_BASE}/api/v1/trigger`, () => {
          return HttpResponse.json({ triggered: true });
        })
      );

      const result = await apiClient.post('/api/v1/trigger');
      expect(result).toEqual({ triggered: true });
    });
  });

  describe('PUT requests', () => {
    it('should make successful PUT requests', async () => {
      server.use(
        http.put(`${API_BASE}/api/v1/update/123`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ ...(body as object), updated: true });
        })
      );

      const result = await apiClient.put('/api/v1/update/123', { name: 'updated' });
      expect(result).toEqual({ name: 'updated', updated: true });
    });

    it('should make PUT request without body', async () => {
      server.use(
        http.put(`${API_BASE}/api/v1/reset/123`, () => {
          return HttpResponse.json({ reset: true });
        })
      );

      const result = await apiClient.put('/api/v1/reset/123');
      expect(result).toEqual({ reset: true });
    });
  });

  describe('PATCH requests', () => {
    it('should make successful PATCH requests', async () => {
      server.use(
        http.patch(`${API_BASE}/api/v1/patch/123`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({ ...(body as object), patched: true });
        })
      );

      const result = await apiClient.patch('/api/v1/patch/123', { status: 'active' });
      expect(result).toEqual({ status: 'active', patched: true });
    });

    it('should make PATCH request without body', async () => {
      server.use(
        http.patch(`${API_BASE}/api/v1/touch/123`, () => {
          return HttpResponse.json({ touched: true });
        })
      );

      const result = await apiClient.patch('/api/v1/touch/123');
      expect(result).toEqual({ touched: true });
    });
  });

  describe('DELETE requests', () => {
    it('should make successful DELETE requests', async () => {
      server.use(
        http.delete(`${API_BASE}/api/v1/delete/123`, () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      await expect(apiClient.delete('/api/v1/delete/123')).resolves.toBeUndefined();
    });

    it('should handle DELETE with JSON response', async () => {
      server.use(
        http.delete(`${API_BASE}/api/v1/archive/123`, () => {
          return HttpResponse.json({ archived: true });
        })
      );

      const result = await apiClient.delete('/api/v1/archive/123');
      expect(result).toEqual({ archived: true });
    });
  });

  describe('token refresh', () => {
    it('should refresh token on 401 and retry request', async () => {
      let callCount = 0;
      const refreshHandler = vi.fn().mockResolvedValue(undefined);

      apiClient.setTokenGetter(() => (callCount === 0 ? 'old-token' : 'new-token'));
      apiClient.setRefreshHandler(refreshHandler);

      server.use(
        http.get(`${API_BASE}/api/v1/protected`, ({ request }) => {
          callCount++;
          const auth = request.headers.get('Authorization');
          if (auth === 'Bearer old-token') {
            return HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
          }
          return HttpResponse.json({ data: 'success' });
        })
      );

      const result = await apiClient.get('/api/v1/protected');
      expect(refreshHandler).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: 'success' });

      // Clean up
      apiClient.setTokenGetter(() => null);
    });

    it('should throw original error if refresh fails', async () => {
      const refreshHandler = vi.fn().mockRejectedValue(new Error('Refresh failed'));
      apiClient.setTokenGetter(() => 'expired-token');
      apiClient.setRefreshHandler(refreshHandler);

      server.use(
        http.get(`${API_BASE}/api/v1/secured`, () => {
          return HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
        })
      );

      await expect(apiClient.get('/api/v1/secured')).rejects.toThrow(APIError);
      expect(refreshHandler).toHaveBeenCalledOnce();

      // Clean up
      apiClient.setTokenGetter(() => null);
    });
  });

  describe('Error handling', () => {
    it('should throw APIError with proper message', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/error`, () => {
          return HttpResponse.json(
            { code: 'VALIDATION_ERROR', message: 'Invalid input' },
            { status: 422 }
          );
        })
      );

      try {
        await apiClient.get('/api/v1/error');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).message).toBe('Invalid input');
        expect((error as APIError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('should re-throw APIError without wrapping', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/api-error`, () => {
          return HttpResponse.json({ code: 'BAD_REQUEST', message: 'Bad' }, { status: 400 });
        })
      );

      try {
        await apiClient.get('/api/v1/api-error');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).status).toBe(400);
      }
    });
  });
});
