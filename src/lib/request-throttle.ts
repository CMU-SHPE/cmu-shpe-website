import { and, count, eq, gte, lt } from 'drizzle-orm'
import { getDb } from '@/db'
import { requestThrottle } from '@/db/schema'
import { WINDOW_MINUTES, isThrottled } from '@/lib/login-throttle'

export type ThrottledAction = 'signup' | 'resend_confirmation' | 'forgot_password' | 'confirm_email'

/**
 * Like recordLoginAttempt, but per action and in its own table, so emailing an admin's
 * address to /join can't lock that admin out of signing in. Rows older than the window
 * are purged on every call, which is what the privacy policy promises.
 */
export async function recordRequest(
  action: ThrottledAction,
  email: string,
  ip: string | null,
): Promise<{ throttled: boolean }> {
  const db = getDb()
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  await db.insert(requestThrottle).values({ action, email, ip })
  await db.delete(requestThrottle).where(lt(requestThrottle.createdAt, windowStart))
  const [[{ emailRequests }], [{ ipRequests }]] = await Promise.all([
    db
      .select({ emailRequests: count() })
      .from(requestThrottle)
      .where(
        and(
          eq(requestThrottle.action, action),
          eq(requestThrottle.email, email),
          gte(requestThrottle.createdAt, windowStart),
        ),
      ),
    ip
      ? db
          .select({ ipRequests: count() })
          .from(requestThrottle)
          .where(
            and(
              eq(requestThrottle.action, action),
              eq(requestThrottle.ip, ip),
              gte(requestThrottle.createdAt, windowStart),
            ),
          )
      : Promise.resolve([{ ipRequests: 0 }]),
  ])
  return { throttled: isThrottled(emailRequests, ipRequests) }
}
