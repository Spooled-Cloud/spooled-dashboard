# Jobs UI

Pages under `/jobs`, `/jobs/[id]`, `/jobs/dlq`. Clients in `src/lib/api/jobs.ts`. Create/bulk/DLQ components under `src/components/jobs/`.

## Workflows

`POST /api/v1/workflows` returns `{ workflow_id, job_ids, status }`, not a full `Workflow`. The backend has no `job_type` column; the client writes it into each job `payload` (same as job create) and sends timeouts as `timeout_seconds`.

## Organization settings

`PUT /api/v1/organizations/{id}` accepts `name`, `billing_email`, `settings`. There is no `description` column; the settings page stores it in `settings.description`. The backend preserves `webhook_token` when settings are replaced.

## Workers

`GET /api/v1/workers/{id}` returns `WorkerResponse` (`max_concurrency`, `current_jobs`, `registered_at`), not the DB `Worker` row (`max_concurrent_jobs`, `current_job_count`, `created_at`). List uses `WorkerSummary` (`max_concurrency` / `current_jobs`).
