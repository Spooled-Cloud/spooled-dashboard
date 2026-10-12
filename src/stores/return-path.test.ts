import { describe, it, expect, beforeEach } from 'vitest';
import { consumeReturnPath, rememberReturnPath } from './return-path';

const store = new Map<string, string>();
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  configurable: true,
});

function setLocation(pathname: string, search = '', hash = '') {
  Object.defineProperty(window, 'location', {
    value: { pathname, search, hash, origin: 'https://dash.example.com', href: '' },
    writable: true,
    configurable: true,
  });
}

describe('return path', () => {
  beforeEach(() => store.clear());

  it('round-trips path, query and hash and clears the stored value', () => {
    setLocation('/jobs', '?status=failed', '#top');
    rememberReturnPath();
    expect(consumeReturnPath()).toBe('/jobs?status=failed#top');
    expect(consumeReturnPath()).toBeNull();
  });

  it('does not remember the login page', () => {
    setLocation('/');
    rememberReturnPath();
    expect(consumeReturnPath()).toBeNull();
  });

  it('rejects off-origin destinations', () => {
    setLocation('/');
    for (const bad of ['https://evil.com/x', '//evil.com', '/\\evil.com']) {
      store.set('redirect_after_login', bad);
      expect(consumeReturnPath()).toBeNull();
    }
  });
});
