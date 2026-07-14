# Security Configuration

This document describes the dashboard's current client-side security model and deployment hardening. It does not replace backend security controls.

## Authentication and token storage

The dashboard exchanges an API key or email verification code for JWTs.

- The short-lived access token and its expiry are persisted by Zustand in `localStorage` under `auth-storage` so a page reload keeps the session.
- The refresh token is memory-only and is deliberately excluded from persisted state.
- Authenticated API requests include `Authorization: Bearer <access-token>` and, when available, `X-Organization-ID`.
- A `401` triggers a shared single-flight refresh attempt while the in-memory refresh token is available (concurrent failures do not stampede refresh).
- Failed refresh, explicit logout, or detected expiry clears local auth state and redirects to the login page.
- Logout sends the refresh token to the backend for revocation before clearing local state.

Because an access token is stored in `localStorage`, preventing script injection is critical. Do not describe the access token as memory-only.

## HTTPS

Use HTTPS for the dashboard and API in production, and use `wss://` for WebSocket traffic. Redirect plaintext HTTP at the ingress, reverse proxy, or CDN.

## Security headers

The Astro Node standalone server applies security headers via `src/middleware.ts` on every response (including HTML and `/api/config`):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/microphone/geolocation/payment/usb disabled)
- `Cross-Origin-Opener-Policy: same-origin`
- `Strict-Transport-Security` (when not already set by the edge)
- `Content-Security-Policy-Report-Only` (report-only while Astro/React still need `'unsafe-inline'`)

`public/_headers` only applies to Cloudflare Pages static hosting and is **not** the production path for this Node+Tunnel deployment. Prefer verifying live response headers on `https://dashboard.spooled.cloud`.

You may still set headers at the edge or reverse proxy. Start with report-only CSP and validate production traffic before enforcing; `connect-src` must include the configured API, WebSocket, and Sentry endpoints.

Example nginx baseline (supplemental):

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000" always;
```

Add `includeSubDomains` only when every current and future subdomain is guaranteed to support HTTPS for the full max-age; an HTTP-only subdomain becomes inaccessible to conforming browsers.

`X-XSS-Protection` is obsolete in modern browsers and is intentionally omitted. Choose framing policy explicitly: `Content-Security-Policy: frame-ancestors 'none'` is stricter than `X-Frame-Options: SAMEORIGIN`; do not set a permissive framing policy by habit.

A deployment-specific CSP might begin as:

```nginx
add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.spooled.cloud wss://api.spooled.cloud https://*.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

Astro and the current UI use inline scripts/styles, so removing `'unsafe-inline'` requires nonce/hash work in product code. Do not copy the example unchanged when deploying against different origins.

## Public runtime configuration

`GET /api/config` exposes `PUBLIC_*` settings plus non-secret build identity (`version`, `commit`) to the browser. Treat every value returned there as public. The client loads this endpoint via `loadRuntimeConfig()` before API/WebSocket/Sentry use.

- Never put API keys, `ADMIN_API_KEY`, Stripe secret keys, or other credentials in `PUBLIC_*` variables.
- `PUBLIC_SENTRY_DSN` is a public client DSN, not an authentication secret.
- Restrict privileged operations in the backend; hiding a dashboard route or feature flag is not authorization.

## Kubernetes hardening

The checked-in Deployment runs as UID/GID `1001` and includes:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001

containers:
  - securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```

A writable `emptyDir` is mounted at `/tmp`. The base manifests do not currently include a `NetworkPolicy`; add one only after mapping ingress, DNS, and egress needs. Remember that API requests originate in users' browsers, not from the dashboard pod.

The optional `spooled-dashboard-secrets` Secret contains Sentry settings, but the current Sentry implementation reads build-time `import.meta.env`; injecting these values only at container runtime does not configure the browser bundle. Prefer an external secret controller for actual secrets and never commit a populated `k8s/base/secrets.yaml`, but remember that a browser Sentry DSN is public configuration rather than a server credential.

## Sentry

Sentry is disabled unless `PUBLIC_SENTRY_DSN` is present when the browser bundle is built. Runtime-only container or Kubernetes environment changes do not currently reconfigure it. The browser integration enables performance sampling and session replay; the implementation configures replay masking/blocking, but server-side Sentry privacy and retention settings must still be reviewed.

Before enabling Sentry:

1. configure project-level PII scrubbing and retention
2. verify no access tokens, API keys, payloads, or sensitive organization data are captured
3. restrict allowed domains/rate limits for the public DSN
4. set `PUBLIC_SENTRY_ENVIRONMENT` and, optionally, `PUBLIC_SENTRY_RELEASE`

## Dependency and image scanning

CI does not currently run `npm audit`. It does run a Trivy filesystem scan for HIGH and CRITICAL findings, but the scan is informational because the workflow uses `exit-code: 0`.

For a release gate, run and review:

```bash
npm audit --audit-level=high
npm run lint
npm run type-check
npm run test
npm run build
```

Scan the published container as part of the deployment process if policy requires a blocking image scan.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Email `security@spooled.cloud` with reproduction details and allow the maintainers time to investigate before disclosure.
