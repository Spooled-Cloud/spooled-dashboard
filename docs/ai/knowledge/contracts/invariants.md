# Invariants

- Never put `ADMIN_API_KEY` or Stripe secrets in `PUBLIC_*`.
- Live verify via `/api/config` version/commit, not image tag alone.
- Dashboard is not the marketing site; do not merge frontend private secrets into this repo.
- Browser runtime config may use local/SSR fallbacks only on local hosts; hosted dashboards must block if `/api/config` fails.
- Admin routes use the same runtime config bootstrap/fail-closed policy as authenticated dashboard routes.
- Never serialise an untouched webhook `secret` field: `null` clears the signing secret and ships unsigned deliveries. Omit it unless the user asked to replace or remove it.
- Admin Custom Limits saves replace the whole `custom_limits` object: build the payload with `mergeCustomLimits` from the org's existing overrides (`src/lib/utils/custom-limits.ts:38`), never from the edited form fields alone, or untouched keys and per-key `null` or `-1` (unlimited) overrides are silently dropped.
- Send credentials in the `Authorization` header. `?token=` is only for the four realtime routes (`/api/v1/ws`, `/api/v1/events`, `/api/v1/events/jobs/{id}`, `/api/v1/events/queues/{name}`), access JWT only, redacted in logs.
- Job list filters (status list, `q`, `job_type`, `tag`, created window) are server-side. Never bring back a client-side scan of rows, and send several statuses as ONE comma-joined `status` value, not one request per status.
- `X-Has-More` is readable cross-origin only when the API's CORS layer exposes it. Paging must work without it (the `per_page + 1` probe) and use it when present; read headers through `apiClient.getWithHeaders`.
- A job list total is exact only when `JobListPage.totalExact` is true (set by `withExactTotal` alone). Otherwise do not print "of N results" / "of M pages": show the range and `Page N`, and enable Next from `hasMore`. A list response with `q`, `job_type` or a created bound but no `X-Has-More` came from a backend that ignores them: show the "cannot filter" notice, never its rows.
- Guards that protect the session key (Revoke, switching a key off) must not fail open: an unknown `user.api_key_id` is refetched from `/auth/me` first and refused if still unknown.
- `failed` is never set on a job (a job that runs out of retries is `deadletter`): do not offer it as a filter or link to it. `/jobs?status=failed` is parsed as `deadletter` for old links.
- Features whose endpoint a backend lacks or refuses hide themselves instead of showing an error: job history (404 falls back to the job's own fields), the incoming webhook log (403 queue-scoped, 404 before 0.1.122), worker counters and webhook `format` (absent field = nothing shown, nothing sent).
- Organization-level actions (delete organization, API-key edit, incoming webhook log) are for unrestricted keys; `isQueueScopedKey` / `isUnrestrictedKey` (`src/lib/utils/key-scope.ts`) mirror the backend's `queue_scope_is_unrestricted`.
