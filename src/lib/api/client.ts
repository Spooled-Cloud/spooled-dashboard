/**
 * API Client for Spooled Backend
 *
 * Provides a centralized client for all API requests with:
 * - Automatic authentication header injection
 * - Token refresh on 401 errors
 * - Organization context handling
 * - Type-safe request/response handling
 * - Error handling and retry logic
 */

import { getApiUrl, DEFAULT_HEADERS, HTTP_STATUS } from '@/lib/constants/api';

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }

  static async fromResponse(response: Response): Promise<APIError> {
    let body: { code?: string; message?: string; details?: Record<string, unknown> } | null = null;
    try {
      body = await response.json();
    } catch {
      // Response body is not JSON
    }

    return new APIError(
      response.status,
      body?.code || 'UNKNOWN_ERROR',
      body?.message || `HTTP Error: ${response.status}`,
      body?.details
    );
  }

  isUnauthorized(): boolean {
    return this.status === HTTP_STATUS.UNAUTHORIZED;
  }

  isForbidden(): boolean {
    return this.status === HTTP_STATUS.FORBIDDEN;
  }

  isNotFound(): boolean {
    return this.status === HTTP_STATUS.NOT_FOUND;
  }

  isValidationError(): boolean {
    return this.status === HTTP_STATUS.UNPROCESSABLE_ENTITY;
  }

  isRateLimited(): boolean {
    return this.status === HTTP_STATUS.TOO_MANY_REQUESTS;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

class APIClient {
  private getBaseUrl: () => string;
  private getToken: (() => string | null) | null = null;
  private getOrgId: (() => string | null) | null = null;
  private refreshToken: (() => Promise<void>) | null = null;

  constructor(baseUrlOrGetter: string | (() => string) = getApiUrl) {
    // Support both static URL and getter function for runtime config
    this.getBaseUrl =
      typeof baseUrlOrGetter === 'function' ? baseUrlOrGetter : () => baseUrlOrGetter;
  }

  /**
   * Set token getter function
   */
  setTokenGetter(getter: () => string | null) {
    this.getToken = getter;
  }

  /**
   * Set organization ID getter function
   */
  setOrgIdGetter(getter: () => string | null) {
    this.getOrgId = getter;
  }

  /**
   * Set token refresh function
   */
  setRefreshHandler(handler: () => Promise<void>) {
    this.refreshToken = handler;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(`${this.getBaseUrl()}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  /**
   * Get headers for request
   */
  private getHeaders(skipAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = { ...DEFAULT_HEADERS };

    if (!skipAuth && this.getToken) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    if (this.getOrgId) {
      const orgId = this.getOrgId();
      if (orgId) {
        headers['X-Organization-ID'] = orgId;
      }
    }

    return headers;
  }

  /**
   * Make HTTP request
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, skipAuth, ...fetchOptions } = options;

    try {
      const response = await fetch(this.buildUrl(endpoint, params), {
        ...fetchOptions,
        headers: {
          ...this.getHeaders(skipAuth),
          ...fetchOptions.headers,
        },
      });

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === HTTP_STATUS.UNAUTHORIZED && !skipAuth && this.refreshToken) {
        try {
          await this.refreshToken();
          // Retry the request with new token
          const retryResponse = await fetch(this.buildUrl(endpoint, params), {
            ...fetchOptions,
            headers: {
              ...this.getHeaders(skipAuth),
              ...fetchOptions.headers,
            },
          });
          return this.handleResponse<T>(retryResponse);
        } catch {
          // Refresh failed, throw original error
          throw await APIError.fromResponse(response);
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      if (error instanceof TypeError) {
        throw new NetworkError();
      }
      throw error;
    }
  }

  /**
   * Handle response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw await APIError.fromResponse(response);
    }

    // Handle 204 No Content
    if (response.status === HTTP_STATUS.NO_CONTENT) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * GET request
   */
  get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params, ...options });
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }
}

// Export singleton instance
export const apiClient = new APIClient();
