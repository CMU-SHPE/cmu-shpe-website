import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/db'
import type { loginAttempts, requestThrottle } from '@/db/schema'
import { WINDOW_MINUTES, type ThrottleLimits } from '@/lib/login-throttle'

type ThrottleTable = typeof loginAttempts | typeof requestThrottle

export type StoreAttempt = {
  table: ThrottleTable
  /** Serialises attempts on one email for one flow, so concurrent ones can't all pass on the same count. */
  lockKey: string
  scope: SQL | undefined
  columns: Record<string, string | null>
  email: string
  ip: string | null
  limits: ThrottleLimits
  /** A browser this account has signed in on skips the per-email ceiling, never the per-source limit. */
  skipEmailCeiling?: boolean
}

function under(table: ThrottleTable, match: SQL | undefined, limit: number) {
  return sql`(select count(*) from ${table} where ${match}) < ${limit}`
}

/**
 * In one transaction: wait for the lock, purge rows past the window, then store the attempt only if
 * every count is still under its limit. A refused attempt is never stored, not even briefly, so one
 * source can't count for more than its own allowance. An unknown source shares one bucket per email.
 */
export async function storeIfAllowed(attempt: StoreAttempt): Promise<{ throttled: boolean }> {
  const { table, lockKey, scope, columns, email, ip, limits, skipEmailCeiling } = attempt
  const db = getDb()
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)
  const inWindow = and(scope, gte(table.createdAt, windowStart))
  const sameSource = ip ? eq(table.ip, ip) : sql`${table.ip} is null`

  const checks = [under(table, and(inWindow, eq(table.email, email), sameSource), limits.perEmailAndIp)]
  if (!skipEmailCeiling) checks.push(under(table, and(inWindow, eq(table.email, email)), limits.perEmail))
  if (ip) checks.push(under(table, and(inWindow, sameSource), limits.perIp))

  const names = Object.keys(columns).map((name) => sql.identifier(name))
  const values = Object.values(columns).map((value) => sql`${value}`)
  const [, , stored] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`),
    db.delete(table).where(lt(table.createdAt, windowStart)),
    db.execute(sql`
      insert into ${table} (${sql.join(names, sql`, `)})
      select ${sql.join(values, sql`, `)}
      where ${sql.join(checks, sql` and `)}
      returning id
    `),
  ])
  return { throttled: (stored as { rows: unknown[] }).rows.length === 0 }
}
