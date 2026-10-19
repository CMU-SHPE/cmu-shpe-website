import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function createDb(url: string) {
  return drizzle(neon(url), { schema })
}

export type Db = ReturnType<typeof createDb>

let cached: Db | undefined

export function getDb(): Db {
  if (cached) return cached

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const localFetchEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT
  if (localFetchEndpoint) {
    neonConfig.fetchEndpoint = localFetchEndpoint
  }

  cached = createDb(url)
  return cached
}
