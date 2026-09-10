# Findings (dashboard)

No new P0/P1 dashboard-specific defects proven in this cartography pass beyond depending on backend contracts. Track UI regressions in future passes with Playwright (`docs/E2E.md`).

| ID    | Sev | Summary                                                                           | Evidence                                                  | Status             |
| ----- | --- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| DB-01 | P2  | Runtime config fetch failure fell back to hosted defaults on non-local dashboards | `src/lib/config/runtime.ts`; `RuntimeConfigBootstrap.tsx` | fixed working tree |
| DB-02 | P1  | Admin pages bypassed runtime config bootstrap and could contact default API       | `src/pages/admin/*`; `src/lib/api/admin.ts`               | fixed working tree |
| DB-03 | P3  | Dead queue-purge stub/flag and orphan dashboard components                       | `src/lib/api/queues.ts`; `src/components/dashboard/*`      | fixed working tree |
| DB-04 | P1  | Quick Lookup attempt always blank: batch status sends `retry_count`, UI read `attempt`/`max_retries` | `src/lib/api/jobs.ts`; `QuickStatusLookup.tsx` | **FIXED** |
| DB-05 | P2  | `JobStatistics` typed `by_queue` and omitted `scheduled`; `GET /jobs/stats` is the opposite | `src/lib/types/index.ts` | **FIXED** |
| DB-06 | P2  | Workflow job cards always showed `job`; `GET /workflows/{id}` hardcodes `job_type` and the real type is in `payload` | `src/lib/api/workflows.ts`; `WorkflowDetailsPage.tsx` | **FIXED** |
| DB-07 | P2  | Jobs list Type column always blank: list summaries omitted `job_type` and the client hardcoded `''` | `src/lib/api/jobs.ts`; backend `JobSummary` | **FIXED** |
| DB-08 | P2  | DLQ Type always `job` and Attempts `0`: `listDeadLetter` mapped `JobSummary` as a full `Job` (`retry_count`/`payload`) | `src/lib/api/jobs.ts`; backend `list_dlq` | **FIXED** |
| DB-09 | P2  | DLQ Error column always empty: summaries omitted `last_error` and the client hardcoded `error: undefined` | `src/lib/api/jobs.ts`; backend `JobSummary` | **FIXED** |
| DB-10 | P2  | Jobs list search/type did nothing: `list` ignored `search` and `job_type` | `src/lib/api/jobs.ts`; `JobsListPage.tsx` | **FIXED** |
| DB-11 | P2  | Job details timeline never showed Failed (mapper hardcoded `failed_at: undefined`) and showed Completed for cancelled jobs (`completed_at` is set on cancel) | `src/lib/api/jobs.ts`; `JobDetailsPage.tsx` | **FIXED** |
| DB-12 | P2  | Job details timeline never showed Next Retry (`next_retry_at` hardcoded undefined; retry wait is `scheduled_at` + `last_error`) | `src/lib/api/jobs.ts`; `JobDetailsPage.tsx` | **FIXED** |
| DB-13 | P2  | Workers Idle card always 0: `healthy` mapped to `active` even when `current_jobs` is 0 | `src/lib/api/workers.ts`; `WorkersListPage.tsx` | **FIXED** |
| DB-14 | P2  | Schedule history showed every successful run as failed: mapper required `status === 'success'` while the scheduler writes `completed`, and dropped failed runs with no `job_id` | `src/lib/api/schedules.ts`; `ScheduleDetailsPage.tsx` | **FIXED** |
| DB-15 | P2  | Create job `timeout_ms` under 1000 became `timeout_seconds` 0 (422); workflow create already clamps to 1 | `src/lib/api/jobs.ts` | **FIXED** |
| DB-16 | P2  | Queue create/update `job_timeout_ms` under 1000 became `default_timeout` 0 (422); job/workflow create already clamp to 1 | `src/lib/api/queues.ts` | **FIXED** |
