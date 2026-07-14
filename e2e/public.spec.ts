import { test, expect } from '@playwright/test';

test.describe('public surfaces', () => {
  test('login page renders and exposes api-key field', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }).or(page.locator('h1, h2').first())).toBeVisible();
    // API key / secret field should exist for login
    const secret = page.getByLabel(/api key|secret|token/i).or(page.locator('input[type="password"]').first());
    await expect(secret.first()).toBeVisible();
  });

  test('runtime config endpoint returns safe public shape', async ({ request }) => {
    const res = await request.get('/api/config');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.apiUrl).toMatch(/^https?:\/\//);
    expect(body.wsUrl).toMatch(/^wss?:\/\//);
    expect(body).toHaveProperty('enableWorkflows');
    expect(body).toHaveProperty('enableSchedules');
    // Must not look like secrets
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toMatch(/sp_live_/);
    expect(serialized).not.toMatch(/admin_api_key/);
  });

  test('security headers present on HTML and config', async ({ request }) => {
    for (const path of ['/', '/api/config']) {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      const headers = res.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']?.toLowerCase()).toBe('deny');
      expect(headers['referrer-policy']).toBeTruthy();
      expect(headers['permissions-policy']).toBeTruthy();
      expect(headers['content-security-policy-report-only'] || headers['content-security-policy']).toBeTruthy();
    }
  });

  test('404 page is branded recovery', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-zz');
    await expect(page.locator('body')).toContainText(/not found|404|spooled/i);
  });
});

test.describe('responsive shell (unauthenticated)', () => {
  test('login usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const secret = page.locator('input[type="password"]').first();
    await expect(secret).toBeVisible();
    const box = await secret.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
  });
});
