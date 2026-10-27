import path from 'path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs run against a deployed preview with `npm run test:e2e`, and *.db.test.ts files
    // need the docker database from `npm run test:db`; neither runs here.
    exclude: [...configDefaults.exclude, 'e2e/**', '**/*.db.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
