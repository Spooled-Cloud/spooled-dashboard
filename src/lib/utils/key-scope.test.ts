import { describe, it, expect } from 'vitest';
import { isQueueScopedKey, isUnrestrictedKey } from './key-scope';

describe('key scope', () => {
  it('treats an empty list or a * entry as unrestricted, like the backend', () => {
    expect(isUnrestrictedKey([])).toBe(true);
    expect(isUnrestrictedKey(['*'])).toBe(true);
    expect(isUnrestrictedKey(['emails', '*'])).toBe(true);
    expect(isQueueScopedKey([])).toBe(false);
    expect(isQueueScopedKey(['*'])).toBe(false);
  });

  it('treats named queues, including prefix patterns, as queue-scoped', () => {
    expect(isQueueScopedKey(['emails'])).toBe(true);
    expect(isQueueScopedKey(['restaurant.prints.*'])).toBe(true);
    expect(isUnrestrictedKey(['emails'])).toBe(false);
  });

  it('is neither scoped nor known-unrestricted while the scope is not loaded', () => {
    expect(isQueueScopedKey(undefined)).toBe(false);
    expect(isQueueScopedKey(null)).toBe(false);
    expect(isUnrestrictedKey(undefined)).toBe(false);
    expect(isUnrestrictedKey(null)).toBe(false);
  });
});
