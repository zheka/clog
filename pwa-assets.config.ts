import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates the app icons in public/ from public/icon.svg: `npm run icons`.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The icon has its own dark background; keep it edge to edge.
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
