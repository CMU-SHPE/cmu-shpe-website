import path from 'path'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs run against a deployed preview with `npm run test:e2e`, and *.pg.test files
    // need a database (`npm run test:db`), so neither runs here.
    exclude: [...configDefaults.exclude, 'e2e/**', 'src/**/*.pg.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
