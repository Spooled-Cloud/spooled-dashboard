import { defineConfig, devices } from '@playwright/test';

/**
 * Deterministic dashboard E2E against a local production build preview.
 * Never bake production secrets into this config.
 *
 * Live smoke (optional): set SPOOLED_E2E_BASE_URL + SPOOLED_E2E_API_KEY.
 */
const isLive = Boolean(process.env.SPOOLED_E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.SPOOLED_E2E_BASE_URL || 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: isLive
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4321',
        url: 'http://127.0.0.1:4321/api/config',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
