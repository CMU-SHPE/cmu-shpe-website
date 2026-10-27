import { neonConfig } from '@neondatabase/serverless'

const databaseUrl = process.env.TEST_DATABASE_URL
const fetchEndpoint = process.env.TEST_NEON_FETCH_ENDPOINT

// getDb() reads DATABASE_URL, so the app's own code talks to the throwaway database. The Neon
// driver otherwise sends queries to https://<host>/sql; locally that is the proxy container.
if (databaseUrl) process.env.DATABASE_URL = databaseUrl
if (fetchEndpoint) neonConfig.fetchEndpoint = () => fetchEndpoint
