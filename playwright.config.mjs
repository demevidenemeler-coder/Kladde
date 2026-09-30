import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:4173/',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
  },
});
