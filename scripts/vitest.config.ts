import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  test: {
    root: rootDir,
    environment: 'node',
    // Only the frontend env validation suite — not the full monorepo.
    include: ['scripts/**/*.test.ts'],
    globals: true,
  },
});
