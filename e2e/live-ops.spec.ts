import { test, expect } from '@playwright/test';

/**
 * Authenticated live flows. Requires:
 *   SPOOLED_E2E_BASE_URL=https://dashboard.spooled.cloud
 *   SPOOLED_E2E_API_KEY=<isolated zz-aitest key>
 *
 * Never log or screenshot the key.
 */
const apiKey = process.env.SPOOLED_E2E_API_KEY;
const liveBase = process.env.SPOOLED_E2E_BASE_URL;

async function login(page: import('@playwright/test').Page) {
  await page.goto(liveBase! + '/');
  await page.locator('input[type="password"]').first().fill(apiKey!);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
  await expect(page).toHaveURL(/dashboard|jobs|queues/, { timeout: 30_000 });
}

test.describe('live ops flows', () => {
  test.skip(!apiKey || !liveBase, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('shell shows realtime status after login', async ({ page }) => {
    await login(page);
    await expect(
      page.getByLabel(/realtime/i).or(page.getByText(/live|connecting|reconnecting/i).first())
    ).toBeVisible({ timeout: 20_000 });
  });

  test('create queue then see it on queues page', async ({ page }) => {
    await login(page);
    const qName = `e2eq${Date.now().toString(36)}`;

    await page.goto(liveBase! + '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    await expect(page.getByText(/Create New Queue|Create Queue/i).first()).toBeVisible();

    const nameInput = page.getByLabel(/name/i).or(page.locator('input[name="name"]')).first();
    await nameInput.fill(qName);
    await page.getByRole('button', { name: /^Create Queue$/ }).last().click();

    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 20_000 });
  });

  test('create job shows success without manual refresh', async ({ page }) => {
    await login(page);

    // Ensure a queue exists first
    const qName = `e2ej${Date.now().toString(36)}`;
    await page.goto(liveBase! + '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    const nameInput = page.getByLabel(/name/i).or(page.locator('input[name="name"]')).first();
    await nameInput.fill(qName);
    await page.getByRole('button', { name: /^Create Queue$/ }).last().click();
    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 20_000 });

    await page.goto(liveBase! + '/jobs');
    await page.getByRole('button', { name: 'Create Job' }).first().click();

    // Queue field — combobox/select/input
    const queueInput = page.getByLabel(/queue/i).first();
    if (await queueInput.isVisible().catch(() => false)) {
      await queueInput.fill(qName);
      // If it's a combobox, press Enter to confirm
      await queueInput.press('Enter').catch(() => undefined);
    }

    const payload = page.locator('textarea').first();
    if (await payload.isVisible().catch(() => false)) {
      await payload.fill(JSON.stringify({ e2e: true }));
    }

    await page.getByRole('button', { name: /^Create Job$/ }).last().click();

    await expect(
      page.getByText(/created|enqueued|success/i).or(page.getByText(qName).first())
    ).toBeVisible({ timeout: 20_000 });
  });

  test('mobile nav opens authenticated shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    const menu = page.getByRole('button', { name: /menu|open navigation|navigation/i }).first();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click();
      await expect(page.getByRole('link', { name: /jobs|dashboard|queues/i }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: /dashboard|jobs/i }).first()).toBeVisible();
    }
  });
});
