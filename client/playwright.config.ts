import { defineConfig, devices } from '@playwright/test';

import {
  CLINIC_TIMEZONE,
  E2E_API_URL,
  E2E_CLIENT_PORT,
  E2E_CLIENT_URL,
  E2E_SOCKET_URL,
} from './e2e/support/config';

const VITE = 'node node_modules/vite/bin/vite.js';
// Its own folder, so the e2e build (pointed at the test API) never replaces a real dist/.
const BUILD_DIR = 'dist-e2e';

export default defineConfig({
  testDir: './e2e',
  // One worker: the tests share one API and database, and the double booking and live update
  // tests depend on what a second window does at the same moment.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // A flaky test is a bug to fix, not to retry.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E_CLIENT_URL,
    locale: 'en-IN',
    timezoneId: CLINIC_TIMEZONE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  // The production build, served by vite preview, talking to the test API.
  webServer: {
    command: `${VITE} build --outDir ${BUILD_DIR} --emptyOutDir && ${VITE} preview --outDir ${BUILD_DIR} --port ${E2E_CLIENT_PORT} --strictPort`,
    url: E2E_CLIENT_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_API_URL: E2E_API_URL,
      VITE_SOCKET_URL: E2E_SOCKET_URL,
      VITE_CLINIC_TIMEZONE: CLINIC_TIMEZONE,
    },
  },
});
