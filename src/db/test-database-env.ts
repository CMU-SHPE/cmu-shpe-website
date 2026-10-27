const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', 'localtest.me', 'db.localtest.me'])
const LOCAL_PROXY_HOSTS = new Set(['localhost', '127.0.0.1'])

function hostOf(value: string, name: string): string {
  try {
    return new URL(value).hostname
  } catch {
    throw new Error(`${name} is not a valid URL`)
  }
}

/**
 * The *.pg.test files truncate every table, so they only ever run against the throwaway
 * containers from scripts/test-db.sh: both variables set, and both pointing at this machine.
 * Returns whether the database tests should run at all.
 */
export function checkTestDatabaseEnv(databaseUrl: string | undefined, fetchEndpoint: string | undefined): boolean {
  if (!databaseUrl && !fetchEndpoint) return false
  if (!databaseUrl || !fetchEndpoint) {
    throw new Error('Set both TEST_DATABASE_URL and TEST_NEON_FETCH_ENDPOINT, or neither')
  }
  const databaseHost = hostOf(databaseUrl, 'TEST_DATABASE_URL')
  if (!LOCAL_DATABASE_HOSTS.has(databaseHost)) {
    throw new Error(`Refusing to run database tests against ${databaseHost}: TEST_DATABASE_URL must be local`)
  }
  const proxyHost = hostOf(fetchEndpoint, 'TEST_NEON_FETCH_ENDPOINT')
  if (!LOCAL_PROXY_HOSTS.has(proxyHost)) {
    throw new Error(`Refusing to send database test queries to ${proxyHost}: TEST_NEON_FETCH_ENDPOINT must be local`)
  }
  return true
}
