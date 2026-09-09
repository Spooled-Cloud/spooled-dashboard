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
