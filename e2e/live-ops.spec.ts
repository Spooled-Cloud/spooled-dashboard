import { test, expect, gotoApp, hasLiveEnv } from './live-session';

/**
 * Authenticated live flows. Requires:
 *   SPOOLED_E2E_BASE_URL=https://dashboard.spooled.cloud   (or a local dashboard)
 *   SPOOLED_E2E_API_KEY=<isolated zz-aitest key>
 *   SPOOLED_E2E_API_URL=<backend URL>   (only when it is not https://api.spooled.cloud)
 *
 * Every test starts from the session that live-session.ts signs in once per worker.
 * Never log or screenshot the key.
 */
test.describe('live ops flows', () => {
  test.skip(!hasLiveEnv, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('shell shows realtime status after login', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await expect(page.getByLabel(/realtime/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('create queue then see it on queues page', async ({ page }) => {
    const qName = `e2eq${Date.now().toString(36)}`;

    await gotoApp(page, '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    await expect(
      page
        .getByRole('heading', { name: /Create New Queue|Create Queue/i })
        .or(page.getByText(/Create New Queue/i))
    ).toBeVisible();

    const nameInput = page.getByLabel(/^name$/i).or(page.locator('input').nth(0));
    await nameInput.first().fill(qName);
    await page
      .getByRole('button', { name: /^Create Queue$/ })
      .last()
      .click();

    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 25_000 });
  });

  test('create job shows success feedback', async ({ page }) => {
    const qName = `e2ej${Date.now().toString(36)}`;
    await gotoApp(page, '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    await page
      .getByLabel(/^name$/i)
      .or(page.locator('input').nth(0))
      .first()
      .fill(qName);
    await page
      .getByRole('button', { name: /^Create Queue$/ })
      .last()
      .click();
    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 25_000 });

    await gotoApp(page, '/jobs');
    await page.getByRole('button', { name: 'Create Job' }).first().click();

    const dialog = page.getByRole('dialog', { name: /Create New Job/i });
    await expect(dialog).toBeVisible();

    // The Queue field is a text input with a datalist of existing queues (a new name can be
    // typed too), not a Radix Select: type the queue we just created.
    await dialog.getByLabel(/^Queue/i).fill(qName);

    await dialog.getByLabel(/Job Type/i).fill('e2e_smoke');
    await dialog.getByLabel(/Payload \(JSON\)/i).fill(JSON.stringify({ e2e: true }));

    await dialog.getByRole('button', { name: /^Create Job$/ }).click();
    // Creating a job opens its detail page.
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}/, { timeout: 25_000 });
  });

  test('mobile nav opens authenticated shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, '/dashboard');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const nav = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(nav.getByRole('link', { name: /Jobs|Dashboard|Queues/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
