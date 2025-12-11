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

export const organizationsAPI = {
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
};
