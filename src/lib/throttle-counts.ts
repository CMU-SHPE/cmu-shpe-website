import { and, eq, gte, isNull, or, sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/db'
import type { loginAttempts, requestThrottle } from '@/db/schema'
import type { ThrottleLimits } from '@/lib/login-throttle'

/**
 * Attempts in the window for this email from this source, for this email from anywhere, and from
 * this source for any email. An unknown source shares one bucket per email, so losing the header
 * falls back to a tight per-email limit rather than none.
 */
export async function attemptCounts(
  table: typeof loginAttempts | typeof requestThrottle,
  scope: SQL | undefined,
  email: string,
  ip: string | null,
  windowStart: Date,
): Promise<ThrottleLimits> {
  const sameEmail = eq(table.email, email)
  const sameIp = ip ? eq(table.ip, ip) : isNull(table.ip)
  const [counts] = await getDb()
    .select({
      perEmailAndIp: sql<number>`count(*) filter (where ${sameEmail} and ${sameIp})`.mapWith(Number),
      perEmail: sql<number>`count(*) filter (where ${sameEmail})`.mapWith(Number),
      perIp: ip ? sql<number>`count(*) filter (where ${sameIp})`.mapWith(Number) : sql<number>`0`.mapWith(Number),
    })
    .from(table)
    .where(and(scope, gte(table.createdAt, windowStart), or(sameEmail, sameIp)))
  return counts
}
