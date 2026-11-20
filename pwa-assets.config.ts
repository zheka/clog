import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// The app icons, generated from public/icon.svg on every build by vite-plugin-pwa (vite.config.ts).
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The icon has its own dark background; keep it edge to edge.
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
