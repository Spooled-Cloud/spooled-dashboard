import { test as base, expect, type BrowserContextOptions, type Page } from '@playwright/test';

/**
 * Shared helpers for the live specs (live-ops, live-shell).
 *
 * The backend allows only 5 logins per minute per IP, so these specs sign in through the UI
 * ONCE per worker and every test reuses that session (`storageState`). Only
 * live-smoke.spec.ts signs in again, because logging in is what it tests.
 *
 * Required environment: SPOOLED_E2E_BASE_URL (the dashboard) and SPOOLED_E2E_API_KEY.
 * Optional: SPOOLED_E2E_API_URL, the backend the dashboard talks to when it is not
 * https://api.spooled.cloud (for example a local backend). Never log or screenshot the key.
 */
export const apiKey = process.env.SPOOLED_E2E_API_KEY;
export const liveBase = process.env.SPOOLED_E2E_BASE_URL;
export const apiBase = process.env.SPOOLED_E2E_API_URL || 'https://api.spooled.cloud';
export const hasLiveEnv = Boolean(apiKey && liveBase);

/** Astro MPA navigations re-bootstrap runtime config; wait until that is done. */
export async function waitReady(page: Page) {
  await expect(page.getByText('Loading runtime configuration')).toHaveCount(0, {
    timeout: 30_000,
  });
}

/** Sign in through the login form and wait for the persisted session. */
export async function login(page: Page) {
  await page.goto(liveBase! + '/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page
    .getByLabel(/api key/i)
    .or(page.locator('input[type="password"]').first())
    .first()
    .fill(apiKey!);
  const signIn = page.getByRole('button', { name: /^Sign In$/i });
  await expect(signIn).toBeEnabled({ timeout: 10_000 });
  const heading = page.getByRole('heading', { name: 'Sign In' });
  const rateLimited = page.getByText(/too many login attempts/i);
  // The backend allows 5 logins per minute per IP. If other runs used them up, wait and retry
  // instead of failing the whole suite.
  for (let attempt = 0; ; attempt++) {
    await signIn.click();
    const outcome = await Promise.race([
      heading.waitFor({ state: 'detached', timeout: 45_000 }).then(() => 'signed-in' as const),
      rateLimited.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'limited' as const),
    ]);
    if (outcome === 'signed-in') break;
    if (attempt >= 4) throw new Error('login stayed rate limited after 5 attempts');
    await page.waitForTimeout(20_000);
    await expect(signIn).toBeEnabled({ timeout: 10_000 });
  }
  await expect(page).toHaveURL(/\/(dashboard|jobs|queues)/, { timeout: 30_000 });
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        state?: { accessToken?: string; isAuthenticated?: boolean };
      };
      return Boolean(parsed?.state?.accessToken || parsed?.state?.isAuthenticated);
    } catch {
      return false;
    }
  });
  await waitReady(page);
}

export async function gotoApp(page: Page, path: string) {
  await page.goto(liveBase! + path, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
}

export async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) throw new Error('missing auth-storage');
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
    const token = parsed.state?.accessToken;
    if (!token) throw new Error('missing access token');
    return token;
  });
}

type SessionState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/** `test` whose pages start already signed in (one UI login per worker). */
export const test = base.extend<object, { sessionState: SessionState }>({
  sessionState: [
    async ({ browser }, use) => {
      if (!hasLiveEnv) {
        await use({ cookies: [], origins: [] });
        return;
      }
      const context = await browser.newContext();
      await login(await context.newPage());
      const state = await context.storageState();
      await context.close();
      await use(state);
    },
    // Room for a few 20 s waits when the login rate limit is hit.
    { scope: 'worker', timeout: 240_000 },
  ],
  storageState: async ({ sessionState }, use) => {
    await use(sessionState);
  },
});

export { expect };
