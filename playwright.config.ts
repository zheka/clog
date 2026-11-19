import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: the production build (`npm run build`) served by `vite preview`, in Chromium
 * emulating an Android phone. Run with `npm run test:e2e` (builds first).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Playwright's recommended CI setup: one worker (small CI machines time out under parallel
  // browsers), two retries, and a trace of the first retry, so a flaky test leaves evidence. A
  // test that passes only on retry is reported as "flaky": look into it.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // On CI: failures as notes on the run, plus an HTML report (with traces) saved as an artifact.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4190/clog/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4190/clog/',
    reuseExistingServer: !process.env.CI,
  },
});
