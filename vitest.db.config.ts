import path from 'path'
import { configDefaults, defineConfig } from 'vitest/config'

// Real-Postgres tests; run them with `npm run test:db`, which starts the database (scripts/test-db.sh).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.db.test.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./vitest.db.setup.ts'],
    // Every file shares the one database and truncates it between tests.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
