import { describe, it, expect } from 'vitest';
import { LEGACY_ROUTE_REDIRECTS } from './legacy-redirects';

// Every route that has a page in src/pages, as the URL it serves ("/jobs/dlq", "/jobs/[id]").
const pages = import.meta.glob('../pages/**/*.astro');
const routes = new Set(
  Object.keys(pages).map(
    (file) =>
      file
        .replace('../pages', '')
        .replace(/\.astro$/, '')
        .replace(/\/index$/, '') || '/'
  )
);

describe('legacy route redirects', () => {
  it('sends the paths that have no page to the page that exists', () => {
    expect(LEGACY_ROUTE_REDIRECTS).toEqual({
      '/settings/members': { status: 302, destination: '/settings/organization' },
      '/webhooks': { status: 302, destination: '/settings/webhooks' },
      '/dlq': { status: 302, destination: '/jobs/dlq' },
    });
  });

  it.each(Object.entries(LEGACY_ROUTE_REDIRECTS))(
    '%s is not a page itself and leads to one',
    (from, { destination }) => {
      expect(routes.has(from)).toBe(false);
      expect(routes.has(destination)).toBe(true);
    }
  );
});
