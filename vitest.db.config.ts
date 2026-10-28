import path from 'path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// Real-Postgres tests; run them with `npm run test:db`, which starts the database (scripts/test-db.sh).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['**/*.db.test.ts', 'src/**/*.pg.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./vitest.db.setup.ts'],
    // Every file shares the one database and truncates it between tests.
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
