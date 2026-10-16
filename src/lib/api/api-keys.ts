/**
 * API Keys API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import { parseHasMore } from './jobs';

export interface APIKey {
  id: string;
  name: string;
  queues: string[];
  /** Requests per minute; can only lower the plan's limit */
  rate_limit: number | null;
  /** True only for the key the email-login flow creates for dashboard sessions */
  is_system?: boolean;
  is_active: boolean;
  created_at: string;
  /**
   * Coarse: the backend writes this at most once per key per 5 minutes, not once per request.
   * A key in constant use can look up to 5 minutes idle, so never present it as real-time — and
   * never treat a recent-looking gap as proof that a key is unused.
   */
  last_used: string | null;
  expires_at: string | null;
}

/** Helper to derive display status from API key fields */
export function getApiKeyStatus(key: APIKey): 'active' | 'revoked' | 'expired' {
  if (!key.is_active) return 'revoked';
  if (key.expires_at && new Date(key.expires_at) < new Date()) return 'expired';
  return 'active';
}

/** Get key prefix from queues for display (shows first queue or *) */
export function getKeyDisplayPrefix(key: APIKey): string {
  if (key.queues.length === 0) return 'none';
  if (key.queues[0] === '*') return 'all queues';
  return key.queues[0];
}

export interface CreateAPIKeyRequest {
  name: string;
  /** Allowed queues; omit/empty => all queues. Supports wildcard '*' */
  queues?: string[];
  /** Optional requests-per-minute cap (1-10000); can only lower the plan's limit, never raise it */
  rate_limit?: number;
  /** ISO datetime string */
  expires_at?: string;
}

export interface CreateAPIKeyResponse {
  id: string;
  name: string;
  key: string; // Full key, only shown once!
  expires_at?: string;
  created_at: string;
}

export interface ApiKeyList {
  keys: APIKey[];
  /**
   * True when a full page repeated, so `keys` is only the newest
   * `API_KEYS_PAGE_SIZE` rows. Backend 0.1.127 ignores limit and offset.
   */
  newestOnly: boolean;
}

export interface UpdateAPIKeyRequest {
  name?: string;
  queues?: string[];
  /** Requests per minute */
  rate_limit?: number;
  is_active?: boolean;
}

/**
 * `MAX_API_KEYS_PER_PAGE` on the backend. A larger limit is clamped, and
 * 0.1.127 ignores limit and offset entirely and always returns this many
 * of the newest rows (revoked included).
 */
export const API_KEYS_PAGE_SIZE = 100;

/** Stop paging even if a server keeps answering that another page exists. */
const API_KEYS_MAX_PAGES = 100;

export const apiKeysAPI = {
  /**
   * GET /api/v1/api-keys
   * Every key, walking limit/offset until `X-Has-More` is false.
   *
   * A server that ignores those params (0.1.127) repeats the same page and
   * sends no `X-Has-More`. A repeated id, or a short page with no header,
   * ends the walk so the first page is still shown and the loop stops.
   * A repeated full page sets `newestOnly`: the caller must not label that
   * slice as every key the organization has.
   */
  list: async (): Promise<ApiKeyList> => {
    const keys: APIKey[] = [];
    const seen = new Set<string>();
    let offset = 0;
    let newestOnly = false;

    for (let page = 0; page < API_KEYS_MAX_PAGES; page++) {
      const { data, headers } = await apiClient.getWithHeaders<APIKey[]>(
        API_ENDPOINTS.API_KEYS.LIST,
        { limit: API_KEYS_PAGE_SIZE, offset }
      );
      const rows = Array.isArray(data) ? data : [];
      let added = 0;
      for (const key of rows) {
        if (!key || typeof key.id !== 'string' || seen.has(key.id)) continue;
        seen.add(key.id);
        keys.push(key);
        added++;
      }
      const hasMore = parseHasMore(headers);
      // Nothing new: the previous page repeated (offset ignored) or the body was empty.
      if (added === 0) {
        // A full page of ids already seen means offset was ignored. An empty
        // body is just the end of a complete list.
        newestOnly = rows.length >= API_KEYS_PAGE_SIZE && keys.length > 0;
        break;
      }
      if (hasMore === false) break;
      // No header and a short page is the end. A full page without a header
      // may be a server that paged but did not expose the header, so continue;
      // the repeated-id check above stops a server that ignored offset.
      if (hasMore !== true && rows.length < API_KEYS_PAGE_SIZE) break;
      offset += rows.length;
    }

    return { keys, newestOnly };
  },

  /**
   * POST /api/v1/api-keys
   * Create a new API key
   */
  create: (data: CreateAPIKeyRequest): Promise<CreateAPIKeyResponse> => {
    return apiClient.post<CreateAPIKeyResponse>(API_ENDPOINTS.API_KEYS.CREATE, data);
  },

  /**
   * GET /api/v1/api-keys/{id}
   * Get API key details
   */
  get: (id: string): Promise<APIKey> => {
    return apiClient.get<APIKey>(API_ENDPOINTS.API_KEYS.GET(id));
  },

  /**
   * PUT /api/v1/api-keys/{id}
   * Update an API key
   */
  update: (id: string, data: UpdateAPIKeyRequest): Promise<APIKey> => {
    return apiClient.put<APIKey>(API_ENDPOINTS.API_KEYS.UPDATE(id), data);
  },

  /**
   * DELETE /api/v1/api-keys/{id}
   * Revoke an API key
   */
  revoke: (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.API_KEYS.REVOKE(id));
  },
};

// Note: backend does not support fine-grained "permissions" for API keys.
// Authorization is queue-scoped via `queues` and optionally `rate_limit`.
