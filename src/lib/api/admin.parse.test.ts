import { describe, it, expect } from 'vitest';
import { parseCreateOrgResponse } from './admin';

describe('parseCreateOrgResponse', () => {
  const valid = {
    organization: {
      id: 'org-1',
      name: 'Test',
      slug: 'zz-aitest-x',
      plan_tier: 'free',
      billing_email: null,
      created_at: '2026-07-14T00:00:00Z',
      updated_at: '2026-07-14T00:00:00Z',
      usage: {
        jobs_today: 0,
        active_jobs: 0,
        queues: 0,
        workers: 0,
        api_keys: 1,
        schedules: 0,
        webhooks: 0,
      },
    },
    api_key: {
      id: 'key-1',
      key: 'sp_live_abcdefghijklmnopqrstuvwxyz',
      name: 'Default',
      created_at: '2026-07-14T00:00:00Z',
    },
  };

  it('accepts backend object-shaped api_key', () => {
    const parsed = parseCreateOrgResponse(valid);
    expect(parsed.api_key.key.startsWith('sp_')).toBe(true);
    expect(parsed.organization.slug).toBe('zz-aitest-x');
  });

  it('rejects bare string api_key (common QA mistake)', () => {
    expect(() =>
      parseCreateOrgResponse({
        ...valid,
        api_key: 'sp_live_not_an_object',
      })
    ).toThrow(/api_key object/);
  });

  it('rejects missing key field', () => {
    expect(() =>
      parseCreateOrgResponse({
        ...valid,
        api_key: { id: 'x', name: 'Default', created_at: '2026-07-14T00:00:00Z' },
      })
    ).toThrow(/api_key.key/);
  });
});
