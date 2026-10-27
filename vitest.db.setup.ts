import { neonConfig } from '@neondatabase/serverless'
import { checkTestDatabaseEnv } from './src/db/test-database-env'

const databaseUrl = process.env.TEST_DATABASE_URL
const fetchEndpoint = process.env.TEST_NEON_FETCH_ENDPOINT

// getDb() reads DATABASE_URL, so the app's own code talks to the throwaway database. The Neon
// driver otherwise sends queries to https://<host>/sql; locally that is the proxy container.
if (checkTestDatabaseEnv(databaseUrl, fetchEndpoint)) {
  process.env.DATABASE_URL = databaseUrl
  neonConfig.fetchEndpoint = () => fetchEndpoint as string
} else {
  delete process.env.DATABASE_URL
}
