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
  // Own fixed ports (sibling projects use Vite's defaults 5173/4173). Fail instead of quietly
  // moving to another port: browsers keep saved data and service workers per port.
  server: { port: 5190, strictPort: true },
  preview: { port: 4190, strictPort: true },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    VitePWA({
      // A new version installs in the background and takes over on the next launch, or
      // right away from the menu (src/pwa.ts). Never reloads by itself mid-entry.
      registerType: 'prompt',
      injectRegister: false,
      // App icons are generated from public/icon.svg on every build (see pwa-assets.config.ts),
      // and added to the manifest and the page's <head> along with the theme colour.
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'CLog',
        short_name: 'CLog',
        description: 'Climbing log',
        display: 'standalone',
        background_color: '#121214',
        theme_color: '#1e1e24',
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
