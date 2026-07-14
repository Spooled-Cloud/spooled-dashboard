import { test, expect } from '@playwright/test';

/**
 * Optional live smoke. Skipped unless SPOOLED_E2E_API_KEY is set.
 * Never log or screenshot the key.
 */
const apiKey = process.env.SPOOLED_E2E_API_KEY;
const liveBase = process.env.SPOOLED_E2E_BASE_URL;

test.describe('live authenticated smoke', () => {
  test.skip(!apiKey || !liveBase, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('login reaches dashboard shell', async ({ page }) => {
    await page.goto(liveBase! + '/');
    const input = page.locator('input[type="password"]').first();
    await input.fill(apiKey!);
    await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
    await expect(page).toHaveURL(/dashboard|jobs|queues/, { timeout: 30_000 });
    // Realtime status should appear somewhere in the shell
    await expect(page.getByLabel(/realtime/i).or(page.getByText(/live|connecting|offline/i).first())).toBeVisible({
      timeout: 15_000,
    });
  });
});
