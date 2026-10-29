import { and, count, eq, gte, lt } from 'drizzle-orm'
import { getDb } from '@/db'
import { requestThrottle } from '@/db/schema'
import { MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP, WINDOW_MINUTES } from '@/lib/login-throttle'

export type ThrottledAction =
  | 'signup'
  | 'resend_confirmation'
  | 'forgot_password'
  | 'confirm_email'
  | 'admin_password_reset'
  | 'change_email'

type RequestLimit = { perEmail: number; perIp: number }

const LOGIN_LIMITS: RequestLimit = { perEmail: MAX_FAILURES_PER_EMAIL, perIp: MAX_FAILURES_PER_IP }

/** Allowed requests per window; the newer actions have their own so changing the login lockout leaves them alone. */
export const REQUEST_LIMITS: Record<ThrottledAction, RequestLimit> = {
  signup: LOGIN_LIMITS,
  resend_confirmation: LOGIN_LIMITS,
  forgot_password: LOGIN_LIMITS,
  confirm_email: LOGIN_LIMITS,
  admin_password_reset: { perEmail: 3, perIp: 10 },
  change_email: { perEmail: 5, perIp: 10 },
}

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
  const limit = REQUEST_LIMITS[action]
  return { throttled: emailRequests > limit.perEmail || ipRequests > limit.perIp }
}
