# Playwright E2E

Deterministic browser tests for the Spooled dashboard.

## Local (preview server)

```bash
npm run build
npm run test:e2e
```

`playwright.config.ts` starts `astro preview` on `127.0.0.1:4321` unless `SPOOLED_E2E_BASE_URL` is set.

## Live specs (optional)

`e2e/live-smoke.spec.ts`, `e2e/live-ops.spec.ts` and `e2e/live-shell.spec.ts` sign in through the real login form and are skipped unless both variables below are set.

| Variable               | Required | Purpose                                                                                                     |
| ---------------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| `SPOOLED_E2E_BASE_URL` |      Yes | Dashboard under test; also turns off the local preview server                                               |
| `SPOOLED_E2E_API_KEY`  |      Yes | API key of an isolated test organization                                                                    |
| `SPOOLED_E2E_API_URL`  |       No | Backend the dashboard talks to, when it is not `https://api.spooled.cloud` (`live-shell` calls it directly) |

```bash
export SPOOLED_E2E_BASE_URL=https://dashboard.spooled.cloud
export SPOOLED_E2E_API_KEY='sp_live_...'   # use an isolated zz-aitest key only
npm run test:e2e -- e2e/live-smoke.spec.ts
```

Never commit keys. Never screenshot secrets.

### Against a local dashboard and backend

Run a local backend, create a throwaway organization there, serve a production build of the dashboard with `PUBLIC_API_URL` pointing at that backend, then run the specs:

```bash
npm run build
HOST=127.0.0.1 PORT=4331 PUBLIC_API_URL=http://127.0.0.1:18080 node dist/server/entry.mjs &

export SPOOLED_E2E_BASE_URL=http://127.0.0.1:4331
export SPOOLED_E2E_API_URL=http://127.0.0.1:18080
export SPOOLED_E2E_API_KEY='<key of the local test organization>'
npm run test:e2e
```

Delete the test organization afterwards.

### Logins and rate limits

The backend allows 5 logins per minute per IP. To stay under that, live mode runs a single Playwright worker, `live-ops` and `live-shell` reuse one UI sign-in per worker (`e2e/live-session.ts`), and only `live-smoke` signs in again because the login is what it tests. A rate-limited sign-in waits and retries. Avoid starting several live runs in the same minute.

## CI note

Add `npx playwright install chromium --with-deps` before `npm run test:e2e` when wiring into Actions.
