import { eq } from 'drizzle-orm'
import { requestThrottle } from '@/db/schema'
import { throttleIp, type ThrottleLimits } from '@/lib/login-throttle'
import { storeIfAllowed } from '@/lib/throttle-store'

export type ThrottledAction =
  | 'signup'
  | 'resend_confirmation'
  | 'forgot_password'
  | 'confirm_email'
  | 'admin_password_reset'
  | 'change_email'
  | 'confirm_email_change'
  | 'account_password_check'
  | 'contact'

/**
 * Allowed requests per window, set per action so changing one flow leaves the others alone.
 * A stranger can only reach perEmail from many networks. For the reset and resend links, reaching
 * it means the owner has just been sent a link that still works, so it caps their inbox without
 * locking them out. perIp of 50 allows for a campus sharing one address.
 */
export const REQUEST_LIMITS: Record<ThrottledAction, ThrottleLimits> = {
  signup: { perEmailAndIp: 3, perEmail: 30, perIp: 50 },
  resend_confirmation: { perEmailAndIp: 3, perEmail: 15, perIp: 50 },
  forgot_password: { perEmailAndIp: 3, perEmail: 15, perIp: 50 },
  confirm_email: { perEmailAndIp: 5, perEmail: 5, perIp: 50 },
  admin_password_reset: { perEmailAndIp: 3, perEmail: 10, perIp: 10 },
  change_email: { perEmailAndIp: 5, perEmail: 5, perIp: 10 },
  confirm_email_change: { perEmailAndIp: 5, perEmail: 5, perIp: 10 },
  account_password_check: { perEmailAndIp: 5, perEmail: 5, perIp: 20 },
  contact: { perEmailAndIp: 5, perEmail: 15, perIp: 20 },
}

/**
 * Like recordLoginAttempt, but per action and in its own table, so emailing an admin's
 * address to /join can't lock that admin out of signing in. Rows older than the window
 * are purged on every call, which is what the privacy policy promises. The count and the
 * store happen under one lock in one transaction, and a refused request is never stored.
 */
export async function recordRequest(
  action: ThrottledAction,
  email: string,
  ip: string | null,
): Promise<{ throttled: boolean }> {
  const source = throttleIp(ip)
  return storeIfAllowed({
    table: requestThrottle,
    flow: action,
    scope: eq(requestThrottle.action, action),
    columns: { action, email, ip: source },
    email,
    ip: source,
    limits: REQUEST_LIMITS[action],
  })
}
