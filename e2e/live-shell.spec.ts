import { test, expect } from '@playwright/test';

/**
 * Authenticated shell + settings route smoke.
 * Requires SPOOLED_E2E_BASE_URL + SPOOLED_E2E_API_KEY.
 */
const apiKey = process.env.SPOOLED_E2E_API_KEY;
const liveBase = process.env.SPOOLED_E2E_BASE_URL;
const apiBase = process.env.SPOOLED_E2E_API_URL || 'https://api.spooled.cloud';

async function waitReady(page: import('@playwright/test').Page) {
  await expect(page.getByText('Loading runtime configuration')).toHaveCount(0, {
    timeout: 30_000,
  });
}

async function login(page: import('@playwright/test').Page) {
  await page.goto(liveBase! + '/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page
    .getByLabel(/api key/i)
    .or(page.locator('input[type="password"]').first())
    .first()
    .fill(apiKey!);
  await page.getByRole('button', { name: /^Sign In$/i }).click();
  await expect(page.getByRole('heading', { name: 'Sign In' })).toHaveCount(0, { timeout: 30_000 });
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

async function gotoApp(page: import('@playwright/test').Page, path: string) {
  await page.goto(liveBase! + path, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
}

async function accessToken(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) throw new Error('missing auth-storage');
    const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
    const token = parsed.state?.accessToken;
    if (!token) throw new Error('missing access token');
    return token;
  });
}

test.describe('live shell surfaces', () => {
  test.skip(!apiKey || !liveBase, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');

  test('settings hub and session/billing pages render', async ({ page }) => {
    await login(page);

    await gotoApp(page, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Session' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Billing' }).first()).toBeVisible();

    await gotoApp(page, '/settings/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible();

    await gotoApp(page, '/settings/billing');
    await expect(page.getByRole('heading', { level: 1, name: /Billing/i })).toBeVisible();

    await gotoApp(page, '/settings/organization');
    await expect(page.getByRole('heading', { level: 1, name: /Organization/i })).toBeVisible();

    await gotoApp(page, '/workers');
    await expect(page.getByRole('heading', { level: 1, name: /Workers/i })).toBeVisible();
    await gotoApp(page, '/jobs/dlq');
    await expect(page.getByRole('heading', { level: 1, name: /Dead Letter|DLQ/i })).toBeVisible();
  });

  test('jobs URL status filter applies from query string', async ({ page }) => {
    await login(page);
    await gotoApp(page, '/jobs?status=failed');
    // Requires dashboard build with JobsListPage URL sync (≥0.1.61)
    const statusSelect = page.locator('select').first();
    await expect(statusSelect).toHaveValue('failed', { timeout: 15_000 });
  });

  test('API-created job appears on jobs list via realtime invalidation', async ({
    page,
    request,
  }) => {
    await login(page);
    const token = await accessToken(page);
    const suffix = Date.now().toString(36);
    const qName = `e2ertq${suffix}`;
    const jobType = `e2ert_${suffix}`;

    const queueRes = await request.put(
      `${apiBase}/api/v1/queues/${encodeURIComponent(qName)}/config`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          queue_name: qName,
          max_retries: 3,
          default_timeout: 300,
        },
      }
    );
    expect(queueRes.ok()).toBeTruthy();

    await gotoApp(page, '/jobs');
    await expect(page.getByLabel(/realtime/i).first()).toBeVisible({ timeout: 20_000 });

    const jobRes = await request.post(`${apiBase}/api/v1/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        queue_name: qName,
        payload: { job_type: jobType, e2e: true },
        priority: 0,
        max_retries: 3,
      },
    });
    expect(jobRes.ok()).toBeTruthy();
    const created = (await jobRes.json()) as { id?: string };
    expect(created.id).toBeTruthy();
    const shortId = created.id!.slice(0, 8);

    // Poll interval is 10s — appear within 8s implies WS invalidation (or faster refetch)
    await expect(
      page.getByText(shortId).or(page.getByText(qName)).or(page.getByText(jobType)).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
