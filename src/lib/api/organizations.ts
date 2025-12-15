/**
 * Organizations API
 */

import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/constants/api';
import type { Organization } from '@/lib/types';

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  invited_by?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  logo_url?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'member';
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  billing_email?: string;
}

export interface CreateOrganizationOptions {
  /** Admin API key for creating organizations when registration is closed */
  adminKey?: string;
}

/** Initial API key returned during organization creation */
export interface InitialApiKey {
  id: string;
  /** The raw API key - SAVE THIS, it's only shown once! */
  key: string;
  name: string;
  created_at: string;
}

/** Response from organization creation - includes initial API key */
export interface CreateOrganizationResponse {
  organization: Organization;
  api_key: InitialApiKey;
}

export const organizationsAPI = {
  /**
   * POST /api/v1/organizations
   * Create a new organization
   *
   * When REGISTRATION_MODE=closed on the backend, requires adminKey option
   * which is sent as X-Admin-Key header.
   *
   * Returns the organization AND an initial API key for immediate access.
   */
  create: (
    data: CreateOrganizationRequest,
    options?: CreateOrganizationOptions
  ): Promise<CreateOrganizationResponse> => {
    const headers: Record<string, string> = {};
    if (options?.adminKey) {
      headers['X-Admin-Key'] = options.adminKey;
    }
    return apiClient.post<CreateOrganizationResponse>(API_ENDPOINTS.ORGANIZATIONS.CREATE, data, {
      headers,
      skipAuth: true, // Organization creation is a public endpoint (with optional admin key)
    });
  },

  /**
   * GET /api/v1/organizations
   * List organizations the user belongs to
   */
  list: (): Promise<Organization[]> => {
    return apiClient.get<Organization[]>(API_ENDPOINTS.ORGANIZATIONS.LIST);
  },

  /**
   * GET /api/v1/organizations/{id}
   * Get organization details
   */
  get: (id: string): Promise<Organization> => {
    return apiClient.get<Organization>(API_ENDPOINTS.ORGANIZATIONS.GET(id));
  },

  /**
   * PUT /api/v1/organizations/{id}
   * Update organization
   */
  update: (id: string, data: UpdateOrganizationRequest): Promise<Organization> => {
    return apiClient.put<Organization>(API_ENDPOINTS.ORGANIZATIONS.UPDATE(id), data);
  },

  /**
   * GET /api/v1/organizations/{id}/members
   * Get organization members
   */
  getMembers: (id: string): Promise<OrganizationMember[]> => {
    return apiClient.get<OrganizationMember[]>(API_ENDPOINTS.ORGANIZATIONS.MEMBERS(id));
  },

  /**
   * POST /api/v1/organizations/{id}/members
   * Invite a new member
   */
  inviteMember: (id: string, data: InviteMemberRequest): Promise<OrganizationMember> => {
    return apiClient.post<OrganizationMember>(API_ENDPOINTS.ORGANIZATIONS.INVITE(id), data);
  },

  /**
   * DELETE /api/v1/organizations/{id}/members/{userId}
   * Remove a member
   */
  removeMember: (orgId: string, userId: string): Promise<void> => {
    return apiClient.delete<void>(`${API_ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId)}/${userId}`);
  },

  /**
   * GET /api/v1/organizations/webhook-token
   * Get the webhook token for the current organization
   */
  getWebhookToken: (): Promise<WebhookTokenResponse> => {
    return apiClient.get<WebhookTokenResponse>('/api/v1/organizations/webhook-token');
  },

  /**
   * POST /api/v1/organizations/webhook-token/regenerate
   * Regenerate the webhook token
   */
  regenerateWebhookToken: (): Promise<WebhookTokenResponse> => {
    return apiClient.post<WebhookTokenResponse>('/api/v1/organizations/webhook-token/regenerate', {});
  },

  /**
   * POST /api/v1/organizations/webhook-token/clear
   * Clear the webhook token (disable authentication)
   */
  clearWebhookToken: (): Promise<WebhookTokenResponse> => {
    return apiClient.post<WebhookTokenResponse>('/api/v1/organizations/webhook-token/clear', { confirm: true });
  },
};

export interface WebhookTokenResponse {
  webhook_token: string | null;
  webhook_url: string;
}
