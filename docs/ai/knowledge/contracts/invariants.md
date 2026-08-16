# Invariants

- Never put `ADMIN_API_KEY` or Stripe secrets in `PUBLIC_*`.
- Live verify via `/api/config` version/commit, not image tag alone.
- Dashboard is not the marketing site; do not merge frontend private secrets into this repo.
- Browser runtime config may use local/SSR fallbacks only on local hosts; hosted dashboards must block if `/api/config` fails.
- Admin routes use the same runtime config bootstrap/fail-closed policy as authenticated dashboard routes.
- Never serialise an untouched webhook `secret` field: `null` clears the signing secret and ships unsigned deliveries. Omit it unless the user asked to replace or remove it.
- Send credentials in the `Authorization` header. `?token=` is only for the four realtime routes (`/api/v1/ws`, `/api/v1/events`, `/api/v1/events/jobs/{id}`, `/api/v1/events/queues/{name}`), access JWT only, redacted in logs.
