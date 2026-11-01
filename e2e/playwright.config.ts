import { defineConfig, devices } from '@playwright/test'
import { previewOrigin } from './preview-guard'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  globalSetup: './preview-guard.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: previewOrigin(process.env.BASE_URL),
    storageState: { cookies: [], origins: [] },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
