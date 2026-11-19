import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: the production build (`npm run build`) served by `vite preview`, in Chromium
 * emulating an Android phone. Run with `npm run test:e2e` (builds first).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4190/clog/',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4190/clog/',
    reuseExistingServer: !process.env.CI,
  },
});
