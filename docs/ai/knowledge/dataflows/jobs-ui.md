# Jobs UI

Pages under `/jobs`, `/jobs/[id]`, `/jobs/dlq`. Clients in `src/lib/api/jobs.ts`. Create/bulk/DLQ components under `src/components/jobs/`.

## Workflows

`POST /api/v1/workflows` returns `{ workflow_id, job_ids, status }`, not a full `Workflow`. The backend has no `job_type` column; the client writes it into each job `payload` (same as job create) and sends timeouts as `timeout_seconds`.
