import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://zheka.github.io/clog/
  base: '/clog/',
  test: {
    include: ['src/**/*.test.ts'],
    // Process CSS so UI tests can apply the real stylesheet (style.css?raw).
    css: true,
  },
});
