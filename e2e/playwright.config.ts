import { defineConfig, devices } from '@playwright/test'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
// Preview deployments are <project>-git-<branch>-<scope>.vercel.app or carry a 9-character
// deployment hash; the production aliases match neither.
const PREVIEW_HOST = /^[a-z0-9-]+-(git-[a-z0-9-]+|[a-z0-9]{9})-[a-z0-9-]+\.vercel\.app$/

/**
 * These specs create real (unconfirmed) member accounts and send real email through
 * Resend, so they must only ever run against a preview deployment or a local server.
 */
function previewBaseUrl(): string {
  const value = process.env.BASE_URL
  if (!value) throw new Error('Set BASE_URL to a preview deployment URL, e.g. BASE_URL=https://<preview>.vercel.app')
  const url = new URL(value)
  const allowed = LOCAL_HOSTS.has(url.hostname) || (url.protocol === 'https:' && PREVIEW_HOST.test(url.hostname))
  if (!allowed) throw new Error(`Refusing to run e2e against ${url.hostname}: only Vercel preview URLs or localhost`)
  return url.origin
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: previewBaseUrl(),
    storageState: { cookies: [], origins: [] },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
