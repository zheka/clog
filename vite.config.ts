import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://zheka.github.io/clog/
  base: '/clog/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
