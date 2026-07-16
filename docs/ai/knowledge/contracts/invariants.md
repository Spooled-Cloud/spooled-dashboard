# Invariants

- Never put `ADMIN_API_KEY` or Stripe secrets in `PUBLIC_*`.
- Live verify via `/api/config` version/commit, not image tag alone.
- Dashboard is not the marketing site; do not merge frontend private secrets into this repo.
- Browser runtime config may use local/SSR fallbacks only on local hosts; hosted dashboards must block if `/api/config` fails.
- Admin routes use the same runtime config bootstrap/fail-closed policy as authenticated dashboard routes.
