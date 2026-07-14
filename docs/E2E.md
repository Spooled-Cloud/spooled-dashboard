# Playwright E2E

Deterministic browser tests for the Spooled dashboard.

## Local (preview server)

```bash
npm run build
npm run test:e2e
```

`playwright.config.ts` starts `astro preview` on `127.0.0.1:4321` unless `SPOOLED_E2E_BASE_URL` is set.

## Live smoke (optional)

```bash
export SPOOLED_E2E_BASE_URL=https://dashboard.spooled.cloud
export SPOOLED_E2E_API_KEY='sp_live_...'   # use an isolated zz-aitest key only
npm run test:e2e -- e2e/live-smoke.spec.ts
```

Never commit keys. Never screenshot secrets.

## CI note

Add `npx playwright install chromium --with-deps` before `npm run test:e2e` when wiring into Actions.
