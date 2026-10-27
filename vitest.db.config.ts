import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Integration tests against a real Postgres through the real Neon HTTP driver; see scripts/test-db.sh.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.pg.test.{ts,tsx}'],
    setupFiles: ['./vitest.db.setup.ts'],
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
