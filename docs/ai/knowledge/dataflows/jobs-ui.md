# Jobs UI

Pages under `/jobs`, `/jobs/[id]`, `/jobs/dlq`. Clients in `src/lib/api/jobs.ts`. Create/bulk/DLQ components under `src/components/jobs/`.

`GET /api/v1/jobs/status?ids=` returns `{ id, status, queue_name, retry_count, created_at, completed_at }`, not `attempt`/`max_retries`. `jobsAPI.batchStatus` maps `retry_count` onto `attempt`. The lookup UI cannot show max retries; that field is not on the batch payload.

`GET /api/v1/jobs/stats` is `{ pending, scheduled, processing, completed, failed, deadletter, cancelled, total }`. It has no `by_queue`/`by_type`/`by_hour`.

`GET /api/v1/jobs` summaries include `job_type` from `payload.job_type` (empty string when absent). `jobsAPI.list` maps that onto `Job.job_type`. The jobs page search box is not a backend query: `list` filters the fetched page by id/job_type substring, and `GET`s a UUID that is not on the page.

There is no `failed_at` column. The details mapper sets `Job.failed_at` from `completed_at`/`updated_at` when status is `failed` or `deadletter`. A pending retry has `last_error` + `scheduled_at`; that maps onto `next_retry_at` so the timeline shows Next Retry instead of Scheduled. Completed only for `completed`, Cancelled from `completed_at` when cancelled, Failed from `failed_at`.

`GET /api/v1/jobs/dlq` is the same `JobSummary[]` (`attempt`, top-level `job_type`, `last_error`), not a full `Job`. `jobsAPI.listDeadLetter` uses the list summary mapper and maps `last_error` onto `Job.error`.

## Workflows

`POST /api/v1/workflows` returns `{ workflow_id, job_ids, status }`, not a full `Workflow`. The backend has no `job_type` column; the client writes it into each job `payload` when that payload is a JSON object (same as job/schedule create) and sends timeouts as `timeout_seconds`. Arrays, strings, and other JSON values are sent as-is — spreading them would turn `"hello"` into `{0:"h",...}`. `GET /workflows/{id}` still sends `job_type: "job"`; `workflowsAPI.get` maps `payload.job_type` onto the UI field.

## Organization settings

`PUT /api/v1/organizations/{id}` accepts `name`, `billing_email`, `settings`. There is no `description` column; the settings page stores it in `settings.description`. The backend preserves `webhook_token` when settings are replaced.

## Workers

`GET /api/v1/workers/{id}` returns `WorkerResponse` (`max_concurrency`, `current_jobs`, `registered_at`), not the DB `Worker` row (`max_concurrent_jobs`, `current_job_count`, `created_at`). List uses `WorkerSummary` (`max_concurrency` / `current_jobs`). Backend status is `healthy`/`degraded`/`offline`/`draining`; the UI maps `healthy` with `current_jobs === 0` to `idle` and other healthy/degraded workers to `active`.
