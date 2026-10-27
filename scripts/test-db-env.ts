const DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', 'db.localtest.me'])
const PROXY_HOSTS = new Set(['localhost', '127.0.0.1'])

export class UnsafeTestDatabaseError extends Error {
  name = 'UnsafeTestDatabaseError'
}

function hostOf(url: string, label: string) {
  try {
    return new URL(url).hostname
  } catch {
    throw new UnsafeTestDatabaseError(`${label} is not a valid URL`)
  }
}

// Database tests truncate every table, so they must only ever reach the throwaway docker database.
export function localTestDatabase(env: Record<string, string | undefined>) {
  const databaseUrl = env.DATABASE_URL
  const fetchEndpoint = env.TEST_DB_FETCH_ENDPOINT
  if (!databaseUrl || !fetchEndpoint) {
    throw new UnsafeTestDatabaseError('DATABASE_URL and TEST_DB_FETCH_ENDPOINT must be set; run `npm run test:db`')
  }
  if (!DATABASE_HOSTS.has(hostOf(databaseUrl, 'DATABASE_URL'))) {
    throw new UnsafeTestDatabaseError('DATABASE_URL must point at the local test database')
  }
  if (!PROXY_HOSTS.has(hostOf(fetchEndpoint, 'TEST_DB_FETCH_ENDPOINT'))) {
    throw new UnsafeTestDatabaseError('TEST_DB_FETCH_ENDPOINT must point at the local Neon proxy')
  }
  return { databaseUrl, fetchEndpoint }
}

// A dynamic import, like pushPreviewSchema's, so tsx hands both the same copy of the driver
// (a static import can load the CommonJS build while the dynamic one loads the ES module build).
export async function connectToLocalNeonProxy(env: Record<string, string | undefined> = process.env) {
  const { databaseUrl, fetchEndpoint } = localTestDatabase(env)
  const { neonConfig } = await import('@neondatabase/serverless')
  neonConfig.fetchEndpoint = () => fetchEndpoint
  return databaseUrl
}
