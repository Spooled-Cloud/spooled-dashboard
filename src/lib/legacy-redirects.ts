/**
 * Paths people guess or remember that have no page, and the page that exists. Wired into
 * `redirects` in astro.config.mjs, so the Node server answers them before any page renders.
 *
 * Temporary (302) so that a path can still become a real page later without browsers
 * holding on to the redirect.
 */
export const LEGACY_ROUTE_REDIRECTS = {
  '/settings/members': { status: 302, destination: '/settings/organization' },
  '/webhooks': { status: 302, destination: '/settings/webhooks' },
  '/dlq': { status: 302, destination: '/jobs/dlq' },
} as const;
