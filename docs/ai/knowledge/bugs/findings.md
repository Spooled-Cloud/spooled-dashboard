# Findings (dashboard)

No new P0/P1 dashboard-specific defects proven in this cartography pass beyond depending on backend contracts. Track UI regressions in future passes with Playwright (`docs/E2E.md`).

| ID | Sev | Summary | Evidence | Status |
|----|-----|---------|----------|--------|
| DB-01 | P2 | Runtime config fetch failure fell back to hosted defaults on non-local dashboards | `src/lib/config/runtime.ts`; `RuntimeConfigBootstrap.tsx` | fixed working tree |
