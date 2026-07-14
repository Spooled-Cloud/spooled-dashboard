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

async function waitReady(page: import('@playwright/test').Page) {
  // Astro MPA navigations re-bootstrap runtime config
  await expect(page.getByText('Loading runtime configuration')).toHaveCount(0, {
    timeout: 30_000,
  });
}

async function login(page: import('@playwright/test').Page) {
  await page.goto(liveBase! + '/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const keyInput = page.getByLabel(/api key/i).or(page.locator('input[type="password"]').first());
  await keyInput.first().fill(apiKey!);
  await page.getByRole('button', { name: /^Sign In$/i }).click();
  // Wait until we leave the login card and auth is persisted
  await expect(page.getByRole('heading', { name: 'Sign In' })).toHaveCount(0, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/(dashboard|jobs|queues)/, { timeout: 30_000 });
  await page.waitForFunction(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string; isAuthenticated?: boolean } };
      return Boolean(parsed?.state?.accessToken || parsed?.state?.isAuthenticated);
    } catch {
      return false;
    }
  });
  await waitReady(page);
}

async function gotoApp(page: import('@playwright/test').Page, path: string) {
  await page.goto(liveBase! + path, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
}

test.describe('live ops flows', () => {
  test.skip(!apiKey || !liveBase, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('shell shows realtime status after login', async ({ page }) => {
    await login(page);
    await expect(
      page.getByLabel(/realtime/i).or(page.getByText(/live|connecting|reconnecting|offline/i).first())
    ).toBeVisible({ timeout: 20_000 });
  });

  test('create queue then see it on queues page', async ({ page }) => {
    await login(page);
    const qName = `e2eq${Date.now().toString(36)}`;

    await gotoApp(page, '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    await expect(page.getByRole('heading', { name: /Create New Queue|Create Queue/i }).or(page.getByText(/Create New Queue/i))).toBeVisible();

    const nameInput = page.getByLabel(/^name$/i).or(page.locator('input').nth(0));
    await nameInput.first().fill(qName);
    await page.getByRole('button', { name: /^Create Queue$/ }).last().click();

    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 25_000 });
  });

  test('create job shows success feedback', async ({ page }) => {
    await login(page);

    const qName = `e2ej${Date.now().toString(36)}`;
    await gotoApp(page, '/queues');
    await page.getByRole('button', { name: 'Create Queue' }).first().click();
    await page.getByLabel(/^name$/i).or(page.locator('input').nth(0)).first().fill(qName);
    await page.getByRole('button', { name: /^Create Queue$/ }).last().click();
    await expect(page.getByText(qName).first()).toBeVisible({ timeout: 25_000 });

    await gotoApp(page, '/jobs');
    await page.getByRole('button', { name: 'Create Job' }).first().click();

    // Prefer selecting queue by typing into visible inputs/selects
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const inputs = dialog.locator('input, textarea, select');
    const count = await inputs.count();
    if (count > 0) {
      // First field often queue name
      await inputs.nth(0).fill(qName);
    }
    const textarea = dialog.locator('textarea').first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill(JSON.stringify({ e2e: true }));
    }

    await dialog.getByRole('button', { name: /^Create Job$/ }).click();
    await expect(
      page.getByText(/created|enqueued|success/i).or(page.getByText(qName).first())
    ).toBeVisible({ timeout: 25_000 });
  });

  test('mobile nav opens authenticated shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.getByRole('link', { name: /Jobs|Dashboard|Queues/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
