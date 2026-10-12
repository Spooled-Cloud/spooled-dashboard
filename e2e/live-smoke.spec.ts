import { test, expect } from '@playwright/test';
import { hasLiveEnv, login } from './live-session';

/**
 * Optional live smoke. Skipped unless SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY are set.
 * This is the one spec that signs in through the login form on every run, because the login
 * is what it tests; live-ops and live-shell reuse a per-worker session instead.
 * Never log or screenshot the key.
 */
test.describe('live authenticated smoke', () => {
  test.skip(!hasLiveEnv, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('login reaches dashboard shell', async ({ page }) => {
    // login() waits out the 5-per-minute login rate limit when other runs used it up.
    test.setTimeout(180_000);
    await login(page);
    await expect(page).toHaveURL(/dashboard|jobs|queues/, { timeout: 30_000 });
    // Realtime status should appear somewhere in the shell. The indicator is both a labelled
    // container ("Realtime Live") and a text span ("Live"), so take the first match of either.
    await expect(
      page
        .getByLabel(/realtime/i)
        .or(page.getByText(/live|connecting|offline/i))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
