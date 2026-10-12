# Jobs UI

Pages under `/jobs`, `/jobs/[id]`, `/jobs/dlq`. Clients in `src/lib/api/jobs.ts`. Create/bulk/DLQ components under `src/components/jobs/`.

`GET /api/v1/jobs/status?ids=` returns `{ id, status, queue_name, retry_count, created_at, completed_at }`, not `attempt`/`max_retries`. `jobsAPI.batchStatus` maps `retry_count` onto `attempt`. The lookup UI cannot show max retries; that field is not on the batch payload.

`GET /api/v1/jobs/stats` is `{ pending, scheduled, processing, completed, failed, deadletter, cancelled, total }`. It has no `by_queue`/`by_type`/`by_hour`.

`GET /api/v1/jobs` summaries include `job_type` from `payload.job_type` (empty string when absent). `jobsAPI.list` maps that onto `Job.job_type`. Search and the job_type filter are client-side: `ListJobsQuery` has no search, so `jobsAPI.list` scans the newest 500 rows (`SEARCH_MAX_SCAN`, `src/lib/api/jobs.ts:80`, loop `:374-396`), filters them by id/job_type substring (`:103-108`), and when nothing matches a UUID it `GET`s `/jobs/{id}` (`:402-418`). Jobs older than the scan window are found only by exact id, and no warning is shown when the window is full. The search box is debounced 300 ms (`src/components/jobs/JobsListPage.tsx:88`).

`GET /api/v1/jobs` has no total: it returns a bare array, so `jobsAPI.list` only counts what the page proves (`jobs.ts:340-366`). The exact count is a separate query, `jobsAPI.getListTotal`, which calls `GET /jobs/stats` for an unfiltered view or one status, optionally within one queue, and returns `undefined` for multi-status (`jobs.ts:437-447`). `JobsListPage` applies it with `withExactTotal` (`jobs.ts:93-101`) only when there is no search or job_type filter and the queue input has settled (`JobsListPage.tsx:119-131`). The count has its own key outside `jobs` (`src/lib/query-client.ts:71-77`), so realtime invalidations do not refetch it, and it has a 60 s stale time (`JobsListPage.tsx:79`). Page jumps stop at `JOBS_LIST_MAX_PAGE` = 200 (`jobs.ts:86`; the notice is at `JobsListPage.tsx:303-305`). Search and job_type views report the match count of the scanned window (`jobs.ts:426-427`).

There is no `failed_at` column. The details mapper sets `Job.failed_at` from `completed_at`/`updated_at` when status is `failed` or `deadletter`. A pending retry has `last_error` + `scheduled_at`; that maps onto `next_retry_at` so the timeline shows Next Retry instead of Scheduled. Completed only for `completed`, Cancelled from `completed_at` when cancelled, Failed from `failed_at`.

`GET /api/v1/jobs/dlq` is the same `JobSummary[]` (`attempt`, top-level `job_type`, `last_error`), not a full `Job`. `jobsAPI.listDeadLetter` uses the list summary mapper and maps `last_error` onto `Job.error`.

DLQ page (`src/components/jobs/DeadLetterQueuePage.tsx`) shows up to 100 rows (`:58`). The dead-letter count is `GET /jobs/stats` for the queue filter (`:63-69`) and is never below the rows on screen (`:69`). Purge sends `limit` equal to the count in its dialog, capped at `DLQ_PURGE_MAX_LIMIT` = 10000 (`src/lib/api/jobs.ts:264-265`; `DeadLetterQueuePage.tsx:244`). It refuses a count below 1 (`:95-98`) and warns when more jobs exist than the cap (`:383-384`). Retry Selected sends `job_ids`; `DLQ_RETRY_MAX_LIMIT` = 100 (`jobs.ts:266-267`) is the backend retry cap. Changing the queue filter clears the selection (`:186-190`).

Create Job (`src/components/jobs/CreateJobDialog.tsx`) sends `scheduled_at` as an RFC 3339 UTC instant. `localDateTimeToIso` (`src/components/jobs/job-form-utils.ts:29-33`) reads the `datetime-local` value as the browser's local time (`CreateJobDialog.tsx:128-141`), and an unparseable date stops the submit (`:129-132`). The form says the time is local (`:274`). Max retries go through `parseMaxRetries` (`job-form-utils.ts:20-22`): an explicit 0 stays 0, values clamp to 0..100, and only an empty or non-numeric field falls back to 3. `BulkEnqueueDialog.tsx:125` uses the same parser. The Backoff Type select is gone, because the backend has no per-job backoff. The queue field is a text input with a datalist of existing queues (`CreateJobDialog.tsx:184-196`), so a new queue name can be typed.

Job details (`src/components/jobs/JobDetailsPage.tsx`) has no Delete. The backend has no hard-delete route: `DELETE /jobs/{id}` only cancels, and returns 409 unless the job is pending or scheduled. Cancel is shown only for those two states (`JobDetailsPage.tsx:406`; buttons at `:471-479` and `:692-700`). `jobsAPI.cancel` (`jobs.ts:497-499`) is the only client for that route, and `jobsAPI.delete` was removed.

## Workflows

`POST /api/v1/workflows` returns `{ workflow_id, job_ids, status }`, not a full `Workflow`. The backend has no `job_type` column; the client writes it into each job `payload` when that payload is a JSON object (same as job/schedule create) and sends timeouts as `timeout_seconds`. Arrays, strings, and other JSON values are sent as-is — spreading them would turn `"hello"` into `{0:"h",...}`. `GET /workflows/{id}` still sends `job_type: "job"`; `workflowsAPI.get` maps `payload.job_type` onto the UI field.

Usage meter: the workflows row in `UsageWidget` is labelled **Active workflows** (`src/components/usage/UsageWidget.tsx:206`); the admin org usage list says **Active Workflows** (`src/components/admin/AdminOrganizationDetail.tsx:871`). The backend counts only pending/running workflows against `max_workflows` (`spooled-backend/src/api/handlers/workflows.rs:668`), so the meter is not a total of all workflows.

Cancel is offered only while a workflow is `pending` or `running`. `canCancelWorkflow` (`src/lib/api/workflows.ts:168-170`) gates the list and details buttons (`src/components/workflows/WorkflowsListPage.tsx:240`, `WorkflowDetailsPage.tsx:303`). A failed cancel shows the backend message in the toast (`WorkflowDetailsPage.tsx:217-221`).

## Organization settings

`PUT /api/v1/organizations/{id}` accepts `name`, `billing_email`, `settings`. There is no `description` column; the settings page stores it in `settings.description`. The backend preserves `webhook_token` when settings are replaced. `settings` is `serde_json::Value`; description writes merge only a plain object (spreading an array/string would become `{0: ...}`).

Billing email confirmation (backend 0.1.117): email sign-in only resolves an org by a **confirmed** billing email (`billing_email_verified_at`). An address set through the API or at onboarding (`POST /organizations`) starts unconfirmed. `BillingEmailVerification` (`components/settings/OrganizationSettings.tsx`, Access card) calls `POST /organizations/billing-email/verification` to send a code and `POST /organizations/billing-email/verify` to confirm it, then invalidates the org detail query.

A changed billing email waits in `pending_billing_email` (`src/lib/types/index.ts:310`). Organization Settings shows it as **Pending confirmation** under Billing Email (`src/components/settings/OrganizationSettings.tsx:511-513`). The verified address keeps its Confirmed badge and stays the sign-in email (`OrganizationSettings.tsx:102-105`), and the code-sent fallback is the pending address (`:62`).

## API keys and admin custom limits

Settings page `/settings/api-keys` → `ApiKeysListPage.tsx` (+ `CreateApiKeyDialog.tsx`); client `src/lib/api/api-keys.ts`.

API key `rate_limit` is requests per minute (1-10000). The create dialog says it can only lower the plan's limit, never raise it (`CreateApiKeyDialog.tsx:305-306`; type comments `src/lib/api/api-keys.ts:12`, `:45`, `:62`). The list shows it as `requests/min` (`ApiKeysListPage.tsx:225`). The scope helper documents `*` and prefix patterns such as `orders.*` (`CreateApiKeyDialog.tsx:283-289`). Expiration is read as the browser's local time and sent as a UTC ISO instant; a past or invalid date is rejected before the request (`CreateApiKeyDialog.tsx:102-120`).

Keys with `is_system: true` are the ones the email-login flow creates for dashboard sessions (`src/lib/api/api-keys.ts:14-15`). They show a **System** badge (`ApiKeysListPage.tsx:196-201`), and revoking one warns that dashboard sessions end (`ApiKeysListPage.tsx:69-70`). The key behind the current session cannot be revoked: its Revoke button is disabled (`ApiKeysListPage.tsx:250`), `handleRevoke` refuses it (`:61-67`), and its row shows **Current session** (`:191-194`).

Admin Custom Limits (`AdminOrganizationDetail.tsx`) edits every field in `CUSTOM_LIMIT_FIELDS` (`:77-91`), including Rate Limit Burst, Job Retention (days) and History Retention (days). The inputs are rendered from that list (`:725`). Save goes through `mergeCustomLimits(existing, initial, edited)` (`src/lib/utils/custom-limits.ts:38-65`, called at `AdminOrganizationDetail.tsx:277`). It starts from the org's current `custom_limits` and changes only the fields the operator edited, because the backend replaces the stored object on save (`spooled-backend/src/api/handlers/admin.rs:452-459`). The eight resource caps (`UNLIMITED_CAPABLE_KEYS`, `custom-limits.ts:15-24`) take an Unlimited checkbox and save as `-1`. A stored `null` or `-1` reads back as Unlimited (`limitToFormValue`, `custom-limits.ts:27-30`). Settings fields (payload size, rate limit, retention) cannot be unlimited. A per-key `null` survives a save (`custom-limits.ts:6`).

## Workers

`GET /api/v1/workers/{id}` returns `WorkerResponse` (`max_concurrency`, `current_jobs`, `registered_at`), not the DB `Worker` row (`max_concurrent_jobs`, `current_job_count`, `created_at`). List uses `WorkerSummary` (`max_concurrency` / `current_jobs`). Backend status is `healthy`/`degraded`/`offline`/`draining`; the UI maps `healthy` with `current_jobs === 0` to `idle` and other healthy/degraded workers to `active`.

`GET /api/v1/dashboard` worker totals are `{ total, healthy, unhealthy }` (`unhealthy = total - healthy`). That is not an idle count. `normalizeDashboardData` maps healthy → `worker_status.active` and unhealthy → `offline`; idle stays 0 because the overview payload has no per-worker `current_jobs`. The workers list page is the source for idle.

The list summary (`WorkerSummary`) has no `registered_at` and no processed or failed counters. `transformWorkerSummary` (`src/lib/api/workers.ts:59-72`) therefore leaves `started_at` undefined, and the list shows neither a start time nor counters. The detail page's Started At comes from `registered_at` (`workers.ts:87`; `src/components/workers/WorkerDetailsPage.tsx:183`), and utilization is 0 when concurrency is 0 (`WorkerDetailsPage.tsx:100-101`). The backend returns no processed or failed counts, so none are shown.

## Queues

`GET /api/v1/queues` returns `QueueConfigSummary` (`max_retries`, `default_timeout`, `rate_limit`, `enabled`) with no settings. `transformQueueSummary` (`src/lib/api/queues.ts:93-103`) leaves concurrency, retry delay and backoff undefined, and the list shows only Max Retries and Job Timeout. The detail payload carries `settings`, but the backend does not enforce concurrency, retry delay, backoff or max retry delay. Those controls are therefore not shown or written: the create request sends only the settings the caller set (`queues.ts:187-196`), and detail Save sends description, max retries and job timeout (`src/components/queues/QueueDetailsPage.tsx:349-359`).

Queue stats: `deadletter` maps from `deadletter_jobs` and stays undefined when the backend omits it (`queues.ts:116`). The detail tile shows an em dash in that case (`QueueDetailsPage.tsx:93`), and the Dead Letter tile sits beside Failed (24h) (`:84`, `:92`). The worker count and the No Workers warning use `stats.active_workers`, which counts `queue_names` (`QueueDetailsPage.tsx:169`, `:241`); `queues.ts:117` maps it.

Create Queue (`src/components/queues/CreateQueueDialog.tsx`) is not an upsert from the UI. It calls `GET /queues/{name}` first. An existing queue refuses the create (`QueueExistsError`, `:27-32`, `:52-63`, `:72-74`) and links to its edit page ("Edit it instead", `:161`). Only a 404 goes on to `PUT`. The name rule matches the backend: letters, digits, `_`, `-` and `.`, and no leading dot or dash (`:25`, `:108`). Max retries 0 is kept (`:118`).
