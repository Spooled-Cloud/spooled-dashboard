import { test, expect, accessToken, apiBase, gotoApp, hasLiveEnv } from './live-session';

/**
 * Authenticated shell + settings route smoke.
 * Requires SPOOLED_E2E_BASE_URL + SPOOLED_E2E_API_KEY, and SPOOLED_E2E_API_URL when the
 * backend is not https://api.spooled.cloud.
 *
 * The session is signed in once per worker (live-session.ts): the backend allows only
 * 5 logins per minute per IP.
 */
test.describe('live shell surfaces', () => {
  test.skip(!hasLiveEnv, 'Requires SPOOLED_E2E_BASE_URL and SPOOLED_E2E_API_KEY');
  test.describe.configure({ mode: 'serial' });

  test('settings, filters, workers/dlq, and realtime job list', async ({ page, request }) => {
    test.setTimeout(180_000);
    await gotoApp(page, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    // Scope to the page content: on a phone the sidebar's own links are in a closed drawer
    // and `.first()` would pick one of those hidden links.
    const content = page.getByRole('main');
    await expect(content.getByRole('link', { name: 'Session' }).first()).toBeVisible();
    await expect(content.getByRole('link', { name: 'Billing' }).first()).toBeVisible();

    await gotoApp(page, '/settings/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible();

    await gotoApp(page, '/settings/billing');
    await expect(page.getByRole('heading', { level: 1, name: /Billing/i })).toBeVisible();

    await gotoApp(page, '/settings/organization');
    await expect(page.getByRole('heading', { level: 1, name: /Organization/i })).toBeVisible();

    await gotoApp(page, '/workers');
    await expect(page.getByRole('heading', { level: 1, name: /Workers/i })).toBeVisible();
    await gotoApp(page, '/jobs/dlq');
    await expect(page.getByRole('heading', { level: 1, name: /Dead.?Letter|DLQ/i })).toBeVisible();

    await gotoApp(page, '/jobs?status=deadletter');
    await expect(page.locator('select').first()).toHaveValue('deadletter', { timeout: 15_000 });

    const token = await accessToken(page);
    const suffix = Date.now().toString(36);
    let qName = `e2ertq${suffix}`;
    const jobType = `e2ert_${suffix}`;

    const listRes = await request.get(`${apiBase}/api/v1/queues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const listed = (await listRes.json()) as Array<{ queue_name?: string; name?: string }>;
    const existing = listed
      .map((q) => q.queue_name || q.name)
      .filter((name): name is string => Boolean(name));

    if (existing.length >= 2) {
      // Free plan caps queues at 2 — reuse one created earlier in the suite/org
      qName = existing[0]!;
    } else {
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
      if (!queueRes.ok()) {
        const body = await queueRes.text();
        throw new Error(`queue create failed ${queueRes.status()}: ${body.slice(0, 200)}`);
      }
    }

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
    if (!jobRes.ok()) {
      const body = await jobRes.text();
      throw new Error(`job create failed ${jobRes.status()}: ${body.slice(0, 200)}`);
    }
    const created = (await jobRes.json()) as { id?: string };
    expect(created.id).toBeTruthy();
    const shortId = created.id!.slice(0, 8);

    await expect(
      page.getByText(shortId).or(page.getByText(qName)).or(page.getByText(jobType)).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
