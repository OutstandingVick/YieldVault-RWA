import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'frontend/**', 'backend/**', 'contracts/**'],
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
