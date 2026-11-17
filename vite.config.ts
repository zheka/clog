import { execSync } from 'node:child_process';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** Shown in the menu: the commit the build was made from, and the build date. */
function appVersion(): string {
  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // not a git checkout
  }
  return `${commit} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  // Served from https://zheka.github.io/clog/
  base: '/clog/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    VitePWA({
      // A new version installs in the background and takes over on the next launch, or
      // right away from the menu (src/pwa.ts). Never reloads by itself mid-entry.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'CLog',
        short_name: 'CLog',
        description: 'Climbing log',
        display: 'standalone',
        background_color: '#121214',
        theme_color: '#1e1e24',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    // Process CSS so UI tests can apply the real stylesheet (style.css?raw).
    css: true,
  },
});
