export const WINDOW_MINUTES = 15
export const MAX_FAILURES_PER_EMAIL = 5
export const MAX_FAILURES_PER_IP = 20

/**
 * Counts include the attempt being checked: it is recorded before counting so
 * concurrent requests cannot all pass on the same stale total.
 */
export function isThrottled(emailAttempts: number, ipAttempts: number): boolean {
  return emailAttempts > MAX_FAILURES_PER_EMAIL || ipAttempts > MAX_FAILURES_PER_IP
}

export function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim()
  return first || null
}
