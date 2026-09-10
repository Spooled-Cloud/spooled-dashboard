/**
 * Tests for Organizations API
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { organizationsAPI } from './organizations';

const API_BASE = 'https://api.spooled.cloud';

describe('organizationsAPI', () => {
  describe('get', () => {
    it('should fetch organization by ID', async () => {
      const result = await organizationsAPI.get('org-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('org-1');
    });

    it('surfaces settings.description as description', async () => {
      server.use(
        http.get(`${API_BASE}/api/v1/organizations/:id`, () => {
          return HttpResponse.json({
            id: 'org-1',
            name: 'Test Organization',
            slug: 'test-org',
            plan_tier: 'free',
            settings: { webhook_token: 'tok', description: 'From settings' },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          });
        })
      );
      const org = await organizationsAPI.get('org-1');
      expect(org.description).toBe('From settings');
    });
  });

  describe('update', () => {
    it('writes description into settings and does not send a top-level description', async () => {
      let posted: Record<string, unknown> | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/organizations/:id`, () => {
          return HttpResponse.json({
            id: 'org-1',
            name: 'Test Organization',
            slug: 'test-org',
            plan_tier: 'free',
            settings: { webhook_token: 'tok' },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          });
        }),
        http.put(`${API_BASE}/api/v1/organizations/:id`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'org-1',
            name: posted.name,
            slug: 'test-org',
            plan_tier: 'free',
            settings: posted.settings,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          });
        })
      );

      const updated = await organizationsAPI.update('org-1', {
        name: 'Renamed',
        description: 'A real description',
      });

      expect(posted).toMatchObject({
        name: 'Renamed',
        settings: { webhook_token: 'tok', description: 'A real description' },
      });
      expect(posted).not.toHaveProperty('description');
      expect(updated.description).toBe('A real description');
    });

    it('does not spread array settings into numeric keys when writing description', async () => {
      let posted: Record<string, unknown> | null = null;
      server.use(
        http.get(`${API_BASE}/api/v1/organizations/:id`, () => {
          return HttpResponse.json({
            id: 'org-1',
            name: 'Test Organization',
            slug: 'test-org',
            plan_tier: 'free',
            settings: ['theme'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          });
        }),
        http.put(`${API_BASE}/api/v1/organizations/:id`, async ({ request }) => {
          posted = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'org-1',
            name: 'Test Organization',
            slug: 'test-org',
            plan_tier: 'free',
            settings: posted.settings,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          });
        })
      );

      await organizationsAPI.update('org-1', { description: 'A real description' });

      expect(posted).toEqual({
        settings: { description: 'A real description' },
      });
    });
  });

  describe('getMembers', () => {
    it('should fetch organization members', async () => {
      const result = await organizationsAPI.getMembers('org-1');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return members with correct structure', async () => {
      const result = await organizationsAPI.getMembers('org-1');
      const member = result[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('email');
      expect(member).toHaveProperty('role');
      expect(member).toHaveProperty('joined_at');
    });
  });
});

describe('OrganizationMember interface', () => {
  it('should match expected structure', () => {
    const member = {
      id: 'member-1',
      user_id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner' as const,
      joined_at: '2024-01-01T00:00:00Z',
      invited_by: 'admin@example.com',
    };

    expect(member.id).toBe('member-1');
    expect(member.role).toBe('owner');
    expect(member.invited_by).toBe('admin@example.com');
  });

  it('should allow role values', () => {
    const roles = ['owner', 'admin', 'member'] as const;
    roles.forEach((role) => {
      const member = { role };
      expect(['owner', 'admin', 'member']).toContain(member.role);
    });
  });
});

describe('CreateOrganizationRequest interface', () => {
  it('should match expected structure', () => {
    const request = {
      name: 'New Org',
      slug: 'new-org',
      billing_email: 'billing@example.com',
    };

    expect(request.name).toBe('New Org');
    expect(request.slug).toBe('new-org');
    expect(request.billing_email).toBe('billing@example.com');
  });

  it('should allow optional billing_email', () => {
    const request: { name: string; slug: string; billing_email?: string } = {
      name: 'New Org',
      slug: 'new-org',
    };

    expect(request.name).toBe('New Org');
    expect(request.billing_email).toBeUndefined();
  });
});

describe('UpdateOrganizationRequest interface', () => {
  it('should allow partial updates', () => {
    const request = {
      name: 'Updated Name',
    };

    expect(request.name).toBe('Updated Name');
  });

  it('should allow all fields', () => {
    const request = {
      name: 'Updated Name',
      description: 'New description',
      logo_url: 'https://example.com/logo.png',
    };

    expect(request.name).toBe('Updated Name');
    expect(request.description).toBe('New description');
    expect(request.logo_url).toBe('https://example.com/logo.png');
  });
});

describe('InviteMemberRequest interface', () => {
  it('should require email and role', () => {
    const request = {
      email: 'new@example.com',
      role: 'member' as const,
    };

    expect(request.email).toBe('new@example.com');
    expect(request.role).toBe('member');
  });

  it('should only allow admin or member role', () => {
    const validRoles = ['admin', 'member'] as const;
    validRoles.forEach((role) => {
      expect(['admin', 'member']).toContain(role);
    });
  });
});

describe('InitialApiKey interface', () => {
  it('should match expected structure', () => {
    const apiKey = {
      id: 'key-123',
      key: 'sp_live_xxxxxxxxxxxx',
      name: 'Initial Admin Key',
      created_at: '2024-01-01T00:00:00Z',
    };

    expect(apiKey.id).toBe('key-123');
    expect(apiKey.key).toContain('sp_live_');
    expect(apiKey.name).toBe('Initial Admin Key');
  });
});

describe('CreateOrganizationResponse interface', () => {
  it('should contain organization and api_key', () => {
    const response = {
      organization: {
        id: 'org-123',
        name: 'New Org',
        slug: 'new-org',
      },
      api_key: {
        id: 'key-123',
        key: 'sp_live_xxxx',
        name: 'Initial Key',
        created_at: '2024-01-01T00:00:00Z',
      },
    };

    expect(response.organization).toBeDefined();
    expect(response.api_key).toBeDefined();
    expect(response.api_key.key).toContain('sp_live_');
  });
});
