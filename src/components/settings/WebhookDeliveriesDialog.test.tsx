import { describe, it, expect } from 'vitest';
import { hasJsonPayload } from './WebhookDeliveriesDialog';

describe('hasJsonPayload', () => {
  it('keeps non-object JSON that Object.keys used to hide', () => {
    expect(hasJsonPayload('hello')).toBe(true);
    expect(hasJsonPayload(false)).toBe(true);
    expect(hasJsonPayload(0)).toBe(true);
    expect(hasJsonPayload([])).toBe(true);
    expect(hasJsonPayload([1])).toBe(true);
  });

  it('treats missing and empty objects as absent', () => {
    expect(hasJsonPayload(undefined)).toBe(false);
    expect(hasJsonPayload(null)).toBe(false);
    expect(hasJsonPayload({})).toBe(false);
  });
});
